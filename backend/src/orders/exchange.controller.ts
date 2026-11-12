import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsOptional,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ExchangeService } from "./exchange.service";

class ExchangeDto extends CreateOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  expectedQuote?: string;
  @IsString() @MinLength(3) @MaxLength(1000) reason: string;
}
class QueueDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @IsString() @MaxLength(100) search = "";
}
class ExchangeQueueDto extends QueueDto {
  @IsOptional()
  @IsIn(["ALL", "REQUESTED", "APPROVED", "REJECTED", "WITHDRAWN"])
  status = "REQUESTED";
}
class RefundQueueDto extends QueueDto {
  @IsOptional() @IsIn(["ALL", "OPEN", "PROCESSING", "COMPLETED"]) status =
    "OPEN";
}
class WithdrawDto {
  @IsInt() @Min(0) @Max(2147483647) version: number;
}
class DecisionDto {
  @IsInt() @Min(0) @Max(2147483647) version: number;
  @IsBoolean() approve: boolean;
  @IsString() @MinLength(3) @MaxLength(1000) note: string;
}
class RefundDto {
  @IsInt() @Min(0) @Max(2147483647) version: number;
  @IsIn(["PROCESSING", "COMPLETED"]) status: "PROCESSING" | "COMPLETED";
  @IsString() @MaxLength(200) reference: string;
  @IsString() @MinLength(3) @MaxLength(1000) note: string;
}
@Controller("orders")
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  constructor(private readonly service: ExchangeService) {}
  @Get(":id/exchanges") list(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.list(user.id, id);
  }
  @Post(":id/exchange-quote") quote(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.service.quote(id, user.id, dto.items);
  }
  @Post(":id/exchanges/:exchangeId/withdraw") withdraw(
    @Param("id", ParseIntPipe) id: number,
    @Param("exchangeId", ParseIntPipe) exchangeId: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: WithdrawDto,
  ) {
    return this.service.withdraw(id, exchangeId, user.id, dto.version);
  }
  @Post(":id/exchanges") request(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: ExchangeDto,
  ) {
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key))
      throw new BadRequestException("Idempotency-Key không hợp lệ");
    if (!dto.reason.trim() || dto.voucherCode)
      throw new BadRequestException("Cần lý do đổi; không áp dụng voucher mới");
    return this.service.request(
      id,
      user.id,
      key,
      dto.items,
      dto.reason.trim(),
      dto.expectedQuote,
    );
  }
  @Get("payment-refunds/mine") refunds(@CurrentUser() user: AuthUser) {
    return this.service.refunds(user.id);
  }
}
@Controller("staff/exchanges")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("BARISTA")
export class StaffExchangeController {
  constructor(private readonly service: ExchangeService) {}
  @Get("queue") queue(@Query() dto: ExchangeQueueDto) {
    return this.service.exchangeQueue(dto.status, dto.page, dto.search.trim());
  }
  @Get() list() {
    return this.service.list();
  }
  @Post(":id/decision") decide(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: DecisionDto,
  ) {
    return this.service.decide(id, user.id, dto.version, dto.approve, dto.note);
  }
}
@Controller("staff/payment-refunds")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("BARISTA")
export class StaffRefundController {
  constructor(private readonly service: ExchangeService) {}
  @Get("queue") queue(@Query() dto: RefundQueueDto) {
    return this.service.refundQueue(dto.status, dto.page, dto.search.trim());
  }
  @Get() list() {
    return this.service.refunds();
  }
  @Post(":id/status") update(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: RefundDto,
  ) {
    return this.service.updateRefund(
      id,
      user.id,
      dto.version,
      dto.status,
      dto.reference,
      dto.note,
    );
  }
}
