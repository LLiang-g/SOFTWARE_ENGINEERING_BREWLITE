-- Migration tăng dần, không sửa init, không xóa đơn hoặc đặt lại kho.
BEGIN;
ALTER TABLE "Recipe" ADD COLUMN "scalesWithSize" BOOLEAN NOT NULL DEFAULT true;
-- Vật tư của seed hiện tại không tăng theo dung tích đồ uống.
UPDATE "Recipe" r SET "scalesWithSize" = false
FROM "Ingredient" i WHERE r."ingredientId" = i.id AND i.name = 'Ly nhựa';

CREATE TABLE "ToppingRecipe" (
  id SERIAL PRIMARY KEY,
  "toppingCode" TEXT NOT NULL,
  "ingredientId" INTEGER NOT NULL REFERENCES "Ingredient"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE ("toppingCode", "ingredientId")
);
-- Tồn kho mới bằng 0: không tự khai khống hàng đang có trong quán.
INSERT INTO "Ingredient" (name, unit, stock) VALUES
('Trân châu topping', 'g', 0), ('Kem topping', 'g', 0) ON CONFLICT (name) DO NOTHING;
INSERT INTO "ToppingRecipe" ("toppingCode", "ingredientId", quantity)
SELECT 'TRAN_CHAU', id, 30 FROM "Ingredient" WHERE name = 'Trân châu topping';
INSERT INTO "ToppingRecipe" ("toppingCode", "ingredientId", quantity)
SELECT 'KEM', id, 20 FROM "Ingredient" WHERE name = 'Kem topping';

ALTER TABLE "Order" ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
                    ADD COLUMN "reservationExpiredAt" TIMESTAMP(3);
CREATE INDEX "Order_reservation_expiry_idx" ON "Order" (status, "reservationExpiresAt", id);
-- Cho đơn cũ có snapshot hợp lệ thêm 30 phút kể từ lúc áp dụng, không hủy hàng loạt ngay.
-- Đơn đổi món đã dùng credit và đơn có bằng chứng thu tiền phải được quầy xử lý.
UPDATE "Order" o SET "reservationExpiresAt" = CURRENT_TIMESTAMP + INTERVAL '30 minutes'
WHERE o.status IN ('PENDING', 'PAYMENT_FAILED') AND o."creditApplied" = 0
 AND EXISTS (SELECT 1 FROM "OrderInventoryReservation" r WHERE r."orderId"=o.id)
 AND NOT EXISTS (SELECT 1 FROM "OrderInventoryReservation" r WHERE r."orderId"=o.id AND r."releasedAt" IS NOT NULL)
 AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."orderId"=o.id)
 AND NOT EXISTS (SELECT 1 FROM "VnpayAttempt" a WHERE a."orderId"=o.id AND a."paidAt" IS NOT NULL);
COMMIT;
