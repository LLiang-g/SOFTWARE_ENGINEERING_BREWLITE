-- BrewLite: complete initialization for an EMPTY database only.
BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Size" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PAYMENT_FAILED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CARD', 'VNPAY');

-- CreateEnum
CREATE TYPE "VnpayAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REVIEW');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'BARISTA');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM');

-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('WITHDRAWN', 'REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RefundCaseStatus" AS ENUM ('OPEN', 'PROCESSING', 'COMPLETED');

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "scalesWithSize" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToppingRecipe" (
    "id" SERIAL NOT NULL,
    "toppingCode" TEXT NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ToppingRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "reservationExpiresAt" TIMESTAMP(3),
    "reservationExpiredAt" TIMESTAMP(3),
    "creditApplied" INTEGER NOT NULL DEFAULT 0,
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "total" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "voucherId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCreateRequest" (
    "userId" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "orderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCreateRequest_pkey" PRIMARY KEY ("userId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "size" "Size" NOT NULL,
    "toppings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qty" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vnpayAttemptId" INTEGER,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VnpayAttempt" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "txnRef" VARCHAR(32) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "VnpayAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "paymentUrl" TEXT NOT NULL,
    "merchantCode" TEXT NOT NULL,
    "createDate" VARCHAR(14) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "providerTxnNo" TEXT,
    "responseCode" TEXT,
    "transactionStatus" TEXT,
    "paidAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VnpayAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentStartRequest" (
    "userId" INTEGER NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "attemptId" INTEGER NOT NULL,

    CONSTRAINT "PaymentStartRequest_pkey" PRIMARY KEY ("userId","key")
);

-- CreateTable
CREATE TABLE "PaymentAudit" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" VARCHAR(40) NOT NULL,
    "note" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderInventoryReservation" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "OrderInventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExchange" (
    "quotedTotal" INTEGER,
    "quotedLines" JSONB,
    "id" SERIAL NOT NULL,
    "sourceOrderId" INTEGER NOT NULL,
    "replacementOrderId" INTEGER,
    "key" VARCHAR(100) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "items" JSONB NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'REQUESTED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "decisionNote" VARCHAR(1000),
    "decidedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "OrderExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefundCase" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "RefundCaseStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "handledBy" INTEGER,
    "reference" VARCHAR(200),
    "note" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentRefundCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_productId_ingredientId_key" ON "Recipe"("productId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "ToppingRecipe_toppingCode_ingredientId_key" ON "ToppingRecipe"("toppingCode", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Order_reservation_expiry_idx" ON "Order"("status", "reservationExpiresAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrderCreateRequest_orderId_key" ON "OrderCreateRequest"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_vnpayAttemptId_key" ON "Payment"("vnpayAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "VnpayAttempt_txnRef_key" ON "VnpayAttempt"("txnRef");

-- CreateIndex
CREATE UNIQUE INDEX "VnpayAttempt_providerTxnNo_key" ON "VnpayAttempt"("providerTxnNo");

-- CreateIndex
CREATE INDEX "VnpayAttempt_orderId_createdAt_idx" ON "VnpayAttempt"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAudit_attemptId_createdAt_idx" ON "PaymentAudit"("attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderInventoryReservation_ingredientId_idx" ON "OrderInventoryReservation"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderInventoryReservation_orderId_ingredientId_key" ON "OrderInventoryReservation"("orderId", "ingredientId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_userId_createdAt_idx" ON "LoyaltyTransaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTransaction_orderId_type_key" ON "LoyaltyTransaction"("orderId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExchange_replacementOrderId_key" ON "OrderExchange"("replacementOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExchange_sourceOrderId_key_key" ON "OrderExchange"("sourceOrderId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefundCase_attemptId_key" ON "PaymentRefundCase"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefundCase_reference_key" ON "PaymentRefundCase"("reference");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToppingRecipe" ADD CONSTRAINT "ToppingRecipe_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCreateRequest" ADD CONSTRAINT "OrderCreateRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCreateRequest" ADD CONSTRAINT "OrderCreateRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vnpayAttemptId_fkey" FOREIGN KEY ("vnpayAttemptId") REFERENCES "VnpayAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VnpayAttempt" ADD CONSTRAINT "VnpayAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentStartRequest" ADD CONSTRAINT "PaymentStartRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentStartRequest" ADD CONSTRAINT "PaymentStartRequest_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "VnpayAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAudit" ADD CONSTRAINT "PaymentAudit_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "VnpayAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAudit" ADD CONSTRAINT "PaymentAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderInventoryReservation" ADD CONSTRAINT "OrderInventoryReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderInventoryReservation" ADD CONSTRAINT "OrderInventoryReservation_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExchange" ADD CONSTRAINT "OrderExchange_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExchange" ADD CONSTRAINT "OrderExchange_replacementOrderId_fkey" FOREIGN KEY ("replacementOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefundCase" ADD CONSTRAINT "PaymentRefundCase_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "VnpayAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_stock_nonnegative" CHECK (stock >= 0);
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_quantity_positive" CHECK (quantity > 0);
ALTER TABLE "ToppingRecipe" ADD CONSTRAINT "ToppingRecipe_quantity_check" CHECK (quantity > 0);
ALTER TABLE "OrderInventoryReservation" ADD CONSTRAINT "OrderInventoryReservation_quantity_positive" CHECK (quantity > 0);
ALTER TABLE "VnpayAttempt" ADD CONSTRAINT "VnpayAttempt_amount_positive" CHECK (amount > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_creditApplied_check" CHECK ("creditApplied" >= 0 AND "creditApplied" <= total);
ALTER TABLE "OrderExchange" ADD CONSTRAINT "OrderExchange_quote_check" CHECK ("quotedTotal" IS NULL OR "quotedTotal" >= 0);
ALTER TABLE "PaymentRefundCase" ADD CONSTRAINT "PaymentRefundCase_amount_check" CHECK (amount > 0);
CREATE UNIQUE INDEX "OrderExchange_one_requested" ON "OrderExchange"("sourceOrderId") WHERE status = 'REQUESTED';


COMMIT;
