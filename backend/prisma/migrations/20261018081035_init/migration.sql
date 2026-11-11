
-- CreateEnum
CREATE TYPE "Size" AS ENUM ('S', 'M', 'L');

CREATE TYPE "OrderStatus" AS ENUM (
    'PENDING', 'PAID', 'PAYMENT_FAILED',
    'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'
);

CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CARD');

CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'BARISTA');

CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM');


-- CreateTable
CREATE TABLE "Product" (
                           "id" SERIAL NOT NULL,
                           "name" TEXT NOT NULL,
                           "price" INTEGER NOT NULL,
                           "imageUrl" TEXT NOT NULL,
                           "stock" INTEGER NOT NULL DEFAULT 0,
                           "version" INTEGER NOT NULL DEFAULT 0,

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


-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

CREATE UNIQUE INDEX "Payment_idempotencyKey_key"
    ON "Payment"("idempotencyKey");

CREATE INDEX "LoyaltyTransaction_userId_createdAt_idx"
    ON "LoyaltyTransaction"("userId", "createdAt");

CREATE UNIQUE INDEX "LoyaltyTransaction_orderId_type_key"
    ON "LoyaltyTransaction"("orderId", "type");


-- AddForeignKey
ALTER TABLE "Order"
    ADD CONSTRAINT "Order_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_voucherId_fkey"
        FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "Order"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "Order"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoyaltyTransaction"
    ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "Order"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill LoyaltyTransaction
-- 1 point for every 10,000 VND from paid orders.

INSERT INTO "LoyaltyTransaction"
("userId", "orderId", "type", "points", "balanceAfter", "createdAt")
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
                  JOIN "Payment" p ON p."orderId" = o."id"
     ) earned
WHERE earned."points" > 0;
