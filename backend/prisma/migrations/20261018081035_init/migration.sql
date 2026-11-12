
-- =========================================
-- 1. CREATE ENUMS
-- =========================================

CREATE TYPE "Size" AS ENUM ('S', 'M', 'L');

CREATE TYPE "OrderStatus" AS ENUM (
    'PENDING',
    'PAID',
    'PAYMENT_FAILED',
    'PREPARING',
    'READY',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CARD');

CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'BARISTA');

CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM');


-- =========================================
-- 2. CREATE TABLES
-- =========================================

CREATE TABLE "Product" (
                           "id" SERIAL NOT NULL,
                           "name" TEXT NOT NULL,
                           "price" INTEGER NOT NULL,
                           "imageUrl" TEXT NOT NULL,

                           CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
                        "id" SERIAL NOT NULL,
                        "email" TEXT NOT NULL,
                        "passwordHash" TEXT NOT NULL,
                        "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
                        "role" "Role" NOT NULL DEFAULT 'CUSTOMER',

                        CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Voucher" (
                           "id" SERIAL NOT NULL,
                           "code" TEXT NOT NULL,
                           "discountPercent" INTEGER NOT NULL,
                           "expiresAt" TIMESTAMP(3) NOT NULL,
                           "active" BOOLEAN NOT NULL DEFAULT true,

                           CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
                         "id" SERIAL NOT NULL,
                         "userId" INTEGER NOT NULL,
                         "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
                         "total" INTEGER NOT NULL,
                         "discount" INTEGER NOT NULL DEFAULT 0,
                         "voucherId" INTEGER,
                         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                         CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "Payment" (
                           "id" SERIAL NOT NULL,
                           "orderId" INTEGER NOT NULL,
                           "idempotencyKey" TEXT NOT NULL,
                           "amount" INTEGER NOT NULL,
                           "method" "PaymentMethod" NOT NULL,
                           "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                           CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "Ingredient" (
                              "id" SERIAL NOT NULL,
                              "name" TEXT NOT NULL,
                              "unit" TEXT NOT NULL,
                              "stock" INTEGER NOT NULL DEFAULT 0,

                              CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recipe" (
                          "id" SERIAL NOT NULL,
                          "productId" INTEGER NOT NULL,
                          "ingredientId" INTEGER NOT NULL,
                          "quantity" INTEGER NOT NULL,

                          CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderInventoryReservation" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3),
    CONSTRAINT "OrderInventoryReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderInventoryReservation_quantity_positive" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "OrderInventoryReservation_orderId_ingredientId_key"
    ON "OrderInventoryReservation"("orderId", "ingredientId");
CREATE INDEX "OrderInventoryReservation_ingredientId_idx"
    ON "OrderInventoryReservation"("ingredientId");

ALTER TABLE "OrderInventoryReservation"
    ADD CONSTRAINT "OrderInventoryReservation_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderInventoryReservation"
    ADD CONSTRAINT "OrderInventoryReservation_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;



-- New requests only; existing orders need no idempotency backfill.
CREATE TABLE "OrderCreateRequest" (
    "userId" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "orderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderCreateRequest_pkey" PRIMARY KEY ("userId", "idempotencyKey")
);
CREATE UNIQUE INDEX "OrderCreateRequest_orderId_key" ON "OrderCreateRequest"("orderId");
ALTER TABLE "OrderCreateRequest" ADD CONSTRAINT "OrderCreateRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderCreateRequest" ADD CONSTRAINT "OrderCreateRequest_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Additive migration after patches 04 and 05. No reset, seed or data deletion.
ALTER TYPE "PaymentMethod" ADD VALUE 'VNPAY';
CREATE TYPE "VnpayAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REVIEW');

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
    CONSTRAINT "VnpayAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VnpayAttempt_amount_positive" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "VnpayAttempt_txnRef_key" ON "VnpayAttempt"("txnRef");
CREATE UNIQUE INDEX "VnpayAttempt_providerTxnNo_key" ON "VnpayAttempt"("providerTxnNo");
CREATE INDEX "VnpayAttempt_orderId_createdAt_idx" ON "VnpayAttempt"("orderId", "createdAt");
ALTER TABLE "VnpayAttempt" ADD CONSTRAINT "VnpayAttempt_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD COLUMN "vnpayAttemptId" INTEGER;
CREATE UNIQUE INDEX "Payment_vnpayAttemptId_key" ON "Payment"("vnpayAttemptId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vnpayAttemptId_fkey"
    FOREIGN KEY ("vnpayAttemptId") REFERENCES "VnpayAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PaymentStartRequest" (
    "userId" INTEGER NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "attemptId" INTEGER NOT NULL,
    CONSTRAINT "PaymentStartRequest_pkey" PRIMARY KEY ("userId", "key")
);
ALTER TABLE "PaymentStartRequest" ADD CONSTRAINT "PaymentStartRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentStartRequest" ADD CONSTRAINT "PaymentStartRequest_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "VnpayAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PaymentAudit" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" VARCHAR(40) NOT NULL,
    "note" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentAudit_attemptId_createdAt_idx" ON "PaymentAudit"("attemptId", "createdAt");
ALTER TABLE "PaymentAudit" ADD CONSTRAINT "PaymentAudit_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "VnpayAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAudit" ADD CONSTRAINT "PaymentAudit_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- =========================================
-- 3. CREATE INDEXES
-- =========================================

CREATE UNIQUE INDEX "User_email_key"
    ON "User"("email");

CREATE UNIQUE INDEX "Voucher_code_key"
    ON "Voucher"("code");

CREATE UNIQUE INDEX "Payment_idempotencyKey_key"
    ON "Payment"("idempotencyKey");

CREATE INDEX "LoyaltyTransaction_userId_createdAt_idx"
    ON "LoyaltyTransaction"("userId", "createdAt");

CREATE UNIQUE INDEX "LoyaltyTransaction_orderId_type_key"
    ON "LoyaltyTransaction"("orderId", "type");

CREATE UNIQUE INDEX "Ingredient_name_key"
    ON "Ingredient"("name");

CREATE UNIQUE INDEX "Recipe_productId_ingredientId_key"
    ON "Recipe"("productId", "ingredientId");


-- =========================================
-- 4. ADD FOREIGN KEYS
-- =========================================

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_userId_fkey"
        FOREIGN KEY ("userId")
            REFERENCES "User"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_voucherId_fkey"
        FOREIGN KEY ("voucherId")
            REFERENCES "Voucher"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey"
        FOREIGN KEY ("orderId")
            REFERENCES "Order"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey"
        FOREIGN KEY ("productId")
            REFERENCES "Product"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_orderId_fkey"
        FOREIGN KEY ("orderId")
            REFERENCES "Order"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;

ALTER TABLE "LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_userId_fkey"
        FOREIGN KEY ("userId")
            REFERENCES "User"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;

ALTER TABLE "LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey"
        FOREIGN KEY ("orderId")
            REFERENCES "Order"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;

ALTER TABLE "Recipe"
    ADD CONSTRAINT "Recipe_productId_fkey"
        FOREIGN KEY ("productId")
            REFERENCES "Product"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;

ALTER TABLE "Recipe"
    ADD CONSTRAINT "Recipe_ingredientId_fkey"
        FOREIGN KEY ("ingredientId")
            REFERENCES "Ingredient"("id")
            ON DELETE RESTRICT
            ON UPDATE CASCADE;


-- =========================================
-- 5. CHECK CONSTRAINTS
-- =========================================

ALTER TABLE "Ingredient"
    ADD CONSTRAINT "Ingredient_stock_nonnegative"
        CHECK ("stock" >= 0);

ALTER TABLE "Recipe"
    ADD CONSTRAINT "Recipe_quantity_positive"
        CHECK ("quantity" > 0);


-- =========================================
-- 6. BACKFILL LOYALTY TRANSACTIONS
-- 1 point for every 10,000 VND
-- from paid orders.
-- =========================================

INSERT INTO "LoyaltyTransaction" (
    "userId",
    "orderId",
    "type",
    "points",
    "balanceAfter",
    "createdAt"
)
SELECT
    earned."userId",
    earned."orderId",
    'EARN',
    earned."points",
    SUM(earned."points") OVER (
        PARTITION BY earned."userId"
        ORDER BY earned."createdAt", earned."orderId"
    ),
    earned."createdAt"
FROM (
         SELECT
             o."userId",
             o."id" AS "orderId",
             FLOOR(o."total" / 10000)::INTEGER AS "points",
             p."createdAt"
         FROM "Order" o
                  INNER JOIN "Payment" p
                             ON p."orderId" = o."id"
         WHERE o."status" = 'PAID'
     ) earned
WHERE earned."points" > 0;
