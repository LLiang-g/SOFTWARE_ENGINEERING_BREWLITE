import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../products/inventory.service";
import { calcUnitPrice } from "../common/pricing";
import { OrdersGateway } from "../realtime/orders.gateway";
import type { OrderItemDto } from "./dto/create-order.dto";

@Injectable()
export class ExchangeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly events: OrdersGateway,
  ) {}

  async quote(orderId: number, userId: number, items: OrderItemDto[]) {
    return this.prisma.$transaction(
      (tx) => this.quoteIn(tx, orderId, userId, items),
      { isolationLevel: "RepeatableRead" },
    );
  }

  private async quoteIn(
    tx: Prisma.TransactionClient,
    orderId: number,
    userId: number,
    items: OrderItemDto[],
  ) {
    const source = await tx.order.findFirst({
      where: { id: orderId, userId },
      include: { payments: true, inventoryReservations: true },
    });
    if (!source) throw new NotFoundException("Không tìm thấy đơn");
    const credit = source.payments.reduce(
      (sum, p) => sum + p.amount,
      source.creditApplied,
    );
    const products = await tx.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      include: { recipes: { include: { ingredient: true } } },
    });
    const demand = new Map<number, number>();
    const stock = new Map<number, number>();
    let message =
      source.status !== "PAID"
        ? "Đơn đã bắt đầu pha hoặc không còn đủ điều kiện đổi."
        : "";
    if (credit !== source.total)
      message = "Khoản tiền của đơn cần quầy đối soát trước khi đổi.";
    const lines = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product)
        throw new BadRequestException(
          "Món đã ngừng bán. Hãy bỏ món đó và chọn lại.",
        );
      if (!product.recipes.length)
        message = `${product.name} chưa sẵn sàng phục vụ.`;
      for (const recipe of product.recipes) {
        demand.set(
          recipe.ingredientId,
          (demand.get(recipe.ingredientId) ?? 0) + recipe.quantity * item.qty,
        );
        stock.set(recipe.ingredientId, recipe.ingredient.stock);
      }
      const toppings = item.toppings ?? [];
      return {
        productId: item.productId,
        name: product.name,
        size: item.size,
        qty: item.qty,
        toppings,
        lineTotal: calcUnitPrice(product.price, item.size, toppings) * item.qty,
      };
    });
    const total = lines.reduce((sum, line) => sum + line.lineTotal, 0),
      difference = total - credit;
    if (!Number.isSafeInteger(total) || total > 9999999999)
      throw new BadRequestException("Tổng tiền quá lớn");
    if (
      !source.inventoryReservations.length ||
      source.inventoryReservations.some((r) => r.releasedAt !== null)
    )
      message = "Đơn cần quầy kiểm tra dữ liệu giữ nguyên liệu.";
    for (const reservation of source.inventoryReservations)
      if (!reservation.releasedAt && stock.has(reservation.ingredientId)) {
        stock.set(
          reservation.ingredientId,
          stock.get(reservation.ingredientId)! + reservation.quantity,
        );
      }
    if ([...demand].some(([id, qty]) => (stock.get(id) ?? 0) < qty))
      message = "Một số món không còn đủ nguyên liệu. Hãy chọn món khác.";
    if (difference < 0)
      message = "Chọn món có tổng giá trị bằng hoặc cao hơn tiền đã trả.";
    if (difference > 0 && difference < 5000)
      message = "Phần thanh toán thêm qua VNPay cần ít nhất 5.000đ.";
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ orderId, credit, lines }))
      .digest("hex");
    return {
      orderId,
      credit,
      total,
      difference,
      lines,
      fingerprint,
      allowed: !message,
      message,
    };
  }

  async withdraw(orderId: number, id: number, userId: number, version: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      if (!(await tx.order.findFirst({ where: { id: orderId, userId } })))
        throw new NotFoundException("Không tìm thấy đơn");
      const result = await tx.orderExchange.updateMany({
        where: { id, sourceOrderId: orderId, version, status: "REQUESTED" },
        data: {
          status: "WITHDRAWN",
          version: { increment: 1 },
          decidedBy: userId,
          decidedAt: new Date(),
          decisionNote: "Khách rút yêu cầu, tiếp tục đơn ban đầu.",
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          "Yêu cầu đã được xử lý. Tải lại để xem kết quả.",
        );
      return tx.orderExchange.findUniqueOrThrow({ where: { id } });
    });
    this.events.notifyOrdersChanged();
    return result;
  }

  async request(
    orderId: number,
    userId: number,
    key: string,
    items: OrderItemDto[],
    reason: string,
    expectedQuote?: string,
  ) {
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ items, reason }))
      .digest("hex");
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
      });
      if (!order) throw new NotFoundException("Không tìm thấy đơn");
      const prior = await tx.orderExchange.findUnique({
        where: { sourceOrderId_key: { sourceOrderId: orderId, key } },
      });
      if (prior) {
        if (prior.requestHash !== requestHash)
          throw new ConflictException("Key đã dùng cho nội dung khác");
        return prior;
      }
      if (order.status !== "PAID")
        throw new ConflictException(
          "Chỉ yêu cầu đổi khi đơn đã trả tiền và chưa pha",
        );
      const pending = await tx.orderExchange.findFirst({
        where: { sourceOrderId: orderId, status: "REQUESTED" },
      });
      if (pending)
        throw new ConflictException("Đã có yêu cầu đổi đang chờ quầy");
      const quote = await this.quoteIn(tx, orderId, userId, items);
      if (!quote.allowed) throw new ConflictException(quote.message);
      if (expectedQuote && quote.fingerprint !== expectedQuote)
        throw new ConflictException(
          "Giá hoặc trạng thái vừa thay đổi. Kiểm tra lại báo giá trước khi gửi.",
        );
      return tx.orderExchange.create({
        data: {
          sourceOrderId: orderId,
          key,
          requestHash,
          quotedTotal: quote.total,
          quotedLines: quote.lines as Prisma.InputJsonValue,
          items: items as unknown as Prisma.InputJsonValue,
          reason,
        },
      });
    });
    this.events.notifyOrdersChanged();
    return result;
  }

  async list(userId?: number, orderId?: number) {
    return this.prisma.orderExchange.findMany({
      where: {
        ...(orderId ? { sourceOrderId: orderId } : {}),
        ...(userId ? { sourceOrder: { userId } } : {}),
      },
      orderBy: { id: "desc" },
      take: 100,
      include: {
        sourceOrder: {
          select: {
            total: true,
            status: true,
            user: { select: { email: true } },
            items: { include: { product: { select: { name: true } } } },
          },
        },
        replacementOrder: {
          select: { id: true, status: true, total: true, creditApplied: true },
        },
      },
    });
  }

  async exchangeQueue(status: string, page: number, search: string) {
    const n = /^\d+$/.test(search) ? Number(search) : null;
    const where: Prisma.OrderExchangeWhereInput = {
      ...(status !== "ALL"
        ? {
            status: status as
              "REQUESTED" | "APPROVED" | "REJECTED" | "WITHDRAWN",
          }
        : {}),
      ...(search
        ? {
            OR: [
              ...(n !== null && Number.isSafeInteger(n) && n <= 2147483647
                ? [{ id: n }, { sourceOrderId: n }]
                : []),
              {
                sourceOrder: {
                  user: {
                    email: { contains: search, mode: "insensitive" as const },
                  },
                },
              },
              { reason: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction(
      [
        this.prisma.orderExchange.count({ where }),
        this.prisma.orderExchange.findMany({
          where,
          skip: (page - 1) * 20,
          take: 20,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: {
            sourceOrder: {
              select: {
                total: true,
                status: true,
                user: { select: { email: true } },
                items: { include: { product: { select: { name: true } } } },
              },
            },
            replacementOrder: {
              select: {
                id: true,
                total: true,
                creditApplied: true,
                status: true,
              },
            },
          },
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / 20)) };
  }

  async refundQueue(status: string, page: number, search: string) {
    const n = /^\d+$/.test(search) ? Number(search) : null;
    const where: Prisma.PaymentRefundCaseWhereInput = {
      ...(status !== "ALL"
        ? { status: status as "OPEN" | "PROCESSING" | "COMPLETED" }
        : {}),
      ...(search
        ? {
            OR: [
              ...(n !== null && Number.isSafeInteger(n) && n <= 2147483647
                ? [{ id: n }, { attempt: { orderId: n } }]
                : []),
              { attempt: { txnRef: { contains: search } } },
              { reference: { contains: search, mode: "insensitive" as const } },
              {
                attempt: {
                  order: {
                    user: {
                      email: { contains: search, mode: "insensitive" as const },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction(
      [
        this.prisma.paymentRefundCase.count({ where }),
        this.prisma.paymentRefundCase.findMany({
          where,
          skip: (page - 1) * 20,
          take: 20,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: {
            attempt: {
              select: {
                orderId: true,
                txnRef: true,
                providerTxnNo: true,
                reviewReason: true,
                order: { select: { user: { select: { email: true } } } },
                audits: {
                  orderBy: { id: "desc" },
                  take: 30,
                  include: { actor: { select: { email: true } } },
                },
              },
            },
          },
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / 20)) };
  }

  async decide(
    id: number,
    actorId: number,
    version: number,
    approve: boolean,
    note: string,
  ) {
    const initial = await this.prisma.orderExchange.findUnique({
      where: { id },
    });
    if (!initial) throw new NotFoundException("Không tìm thấy yêu cầu");
    const result = await this.prisma.$transaction(
      async (tx) => {
        // Same first lock as payment, cancellation and barista preparation.
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${initial.sourceOrderId} FOR UPDATE`;
        const exchange = await tx.orderExchange.findUniqueOrThrow({
          where: { id },
        });
        if (exchange.version !== version || exchange.status !== "REQUESTED")
          throw new ConflictException("Yêu cầu vừa được xử lý, hãy tải lại");
        const source = await tx.order.findUniqueOrThrow({
          where: { id: exchange.sourceOrderId },
          include: { payments: true },
        });
        if (approve) {
          if (source.status !== "PAID")
            throw new ConflictException(
              "Đơn đã pha hoặc không còn đủ điều kiện đổi",
            );
          const received = source.payments.reduce(
            (sum, payment) => sum + payment.amount,
            source.creditApplied,
          );
          if (received !== source.total)
            throw new ConflictException(
              "Tiền đã trả chưa khớp tổng đơn, cần đối soát",
            );
          const items = exchange.items as unknown as OrderItemDto[];
          const products = await tx.product.findMany({
            where: { id: { in: items.map((item) => item.productId) } },
          });
          const currentLines = items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            if (!product)
              throw new BadRequestException("Món thay thế không còn tồn tại");
            const toppings = item.toppings ?? [];
            return {
              productId: item.productId,
              size: item.size,
              qty: item.qty,
              toppings,
              lineTotal:
                calcUnitPrice(product.price, item.size, toppings) * item.qty,
            };
          });
          // A customer's accepted quote must survive price changes while waiting for staff.
          if (exchange.quotedTotal === null || !exchange.quotedLines)
            throw new ConflictException(
              "Yêu cầu cũ chưa có báo giá. Từ chối và mời khách chọn lại món.",
            );
          const snapshots = exchange.quotedLines as unknown as {
            lineTotal: number;
          }[];
          if (snapshots.length !== currentLines.length)
            throw new ConflictException("Báo giá không hợp lệ");
          const lines = currentLines.map((line, index) => ({
            ...line,
            lineTotal: snapshots[index].lineTotal,
          }));
          const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
          if (total !== exchange.quotedTotal)
            throw new ConflictException("Báo giá không khớp");
          const difference = total - received;
          if (!Number.isSafeInteger(total) || total > 9999999999)
            throw new BadRequestException("Tổng tiền quá lớn");
          if (difference < 0)
            throw new ConflictException(
              "Hãy chọn món có giá trị bằng hoặc cao hơn tiền đã trả",
            );
          if (difference > 0 && difference < 5000)
            throw new ConflictException(
              "Chênh lệch VNPay tối thiểu 5.000đ; hãy chọn lại món",
            );
          const old = await tx.orderInventoryReservation.findMany({
            where: { orderId: source.id },
          });
          const recipes = await tx.recipe.findMany({
            where: { productId: { in: items.map((item) => item.productId) } },
          });
          const ingredientIds = [
            ...new Set([
              ...old.map((r) => r.ingredientId),
              ...recipes.map((r) => r.ingredientId),
            ]),
          ].sort((a, b) => a - b);
          if (!ingredientIds.length)
            throw new ConflictException("Thiếu snapshot hoặc công thức");
          // Lock union before release/reserve so exchanges sharing ingredients cannot lock in reverse order.
          await tx.$queryRaw`SELECT id FROM "Ingredient" WHERE id IN (${Prisma.join(ingredientIds)}) ORDER BY id FOR UPDATE`;
          await this.inventory.release(tx, source.id);
          const needs = new Map<number, number>();
          for (const item of items)
            needs.set(
              item.productId,
              (needs.get(item.productId) ?? 0) + item.qty,
            );
          const reservations = await this.inventory.reserve(tx, needs);
          const replacement = await tx.order.create({
            data: {
              userId: source.userId,
              total,
              creditApplied: received,
              status: difference === 0 ? "PAID" : "PENDING",
              items: { create: lines },
              inventoryReservations: { create: reservations },
            },
          });
          await tx.order.update({
            where: { id: source.id },
            data: { status: "CANCELLED" },
          });
          const changed = await tx.orderExchange.updateMany({
            where: { id, version, status: "REQUESTED" },
            data: {
              status: "APPROVED",
              version: { increment: 1 },
              replacementOrderId: replacement.id,
              decidedBy: actorId,
              decidedAt: new Date(),
              decisionNote: note,
            },
          });
          if (changed.count !== 1)
            throw new ConflictException("Yêu cầu vừa thay đổi");
        } else {
          const changed = await tx.orderExchange.updateMany({
            where: { id, version, status: "REQUESTED" },
            data: {
              status: "REJECTED",
              version: { increment: 1 },
              decidedBy: actorId,
              decidedAt: new Date(),
              decisionNote: note,
            },
          });
          if (changed.count !== 1)
            throw new ConflictException("Yêu cầu vừa thay đổi");
        }
        return tx.orderExchange.findUniqueOrThrow({ where: { id } });
      },
      { timeout: 20000, maxWait: 10000 },
    );
    this.events.notifyOrdersChanged();
    return result;
  }

  refunds(userId?: number) {
    return this.prisma.paymentRefundCase.findMany({
      where: userId ? { attempt: { order: { userId } } } : {},
      orderBy: { id: "desc" },
      take: 100,
      include: {
        attempt: {
          select: {
            orderId: true,
            txnRef: true,
            providerTxnNo: true,
            reviewReason: true,
            order: { select: { user: { select: { email: true } } } },
            audits: {
              orderBy: { id: "desc" },
              take: 30,
              include: { actor: { select: { email: true } } },
            },
          },
        },
      },
    });
  }

  async updateRefund(
    id: number,
    actorId: number,
    version: number,
    status: "PROCESSING" | "COMPLETED",
    reference: string,
    note: string,
  ) {
    if (note.trim().length < 3)
      throw new BadRequestException("Ghi chú cần ít nhất 3 ký tự");
    return this.prisma
      .$transaction(async (tx) => {
        const row = await tx.paymentRefundCase.findUnique({ where: { id } });
        if (!row) throw new NotFoundException("Không tìm thấy khoản thu dư");
        if (row.version !== version || row.status === "COMPLETED")
          throw new ConflictException("Hồ sơ vừa thay đổi hoặc đã hoàn");
        if (status === "COMPLETED" && row.status !== "PROCESSING")
          throw new ConflictException(
            "Phải chuyển Đang xử lý trước khi xác nhận đã hoàn",
          );
        if (status === "COMPLETED" && reference.trim().length < 5)
          throw new BadRequestException("Cần mã chứng từ chuyển tiền thực tế");
        const result = await tx.paymentRefundCase.updateMany({
          where: { id, version, status: row.status },
          data: {
            status,
            version: { increment: 1 },
            handledBy: actorId,
            note,
            ...(status === "COMPLETED"
              ? { reference: reference.trim(), completedAt: new Date() }
              : {}),
          },
        });
        if (result.count !== 1)
          throw new ConflictException("Nhân viên khác vừa cập nhật");
        await tx.paymentAudit.create({
          data: {
            attemptId: row.attemptId,
            actorId,
            action: `REFUND_${status}`,
            note: `${note}${status === "COMPLETED" ? `; chứng từ: ${reference.trim()}` : ""}`.slice(
              0,
              1000,
            ),
          },
        });
        return tx.paymentRefundCase.findUniqueOrThrow({ where: { id } });
      })
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === "P2002")
          throw new ConflictException(
            "Chứng từ đã dùng cho hồ sơ khác. Kiểm tra lại trước khi xác nhận.",
          );
        throw error;
      });
  }
}
