-- Zachová původních devět míst celé části i již uložené hodnoty.
-- Historické částky se nepřepočítávají.
ALTER TABLE "InvoiceItem" ALTER COLUMN "quantity" TYPE DECIMAL(18, 9);
