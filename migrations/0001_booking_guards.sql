--> statement-breakpoint
-- Guards run inside the statement's transaction, including writes outside the API.
CREATE TRIGGER bookings_guard_insert BEFORE INSERT ON bookings
WHEN NEW.status = 'active'
BEGIN
 SELECT RAISE(ABORT, 'inactive_reference') WHERE
  EXISTS(SELECT 1 FROM services WHERE tenant_id = NEW.tenant_id AND id = NEW.service_id AND active = 0) OR
  EXISTS(SELECT 1 FROM customers WHERE tenant_id = NEW.tenant_id AND id = NEW.customer_id AND active = 0);
 SELECT RAISE(ABORT, 'booking_overlap') WHERE EXISTS (
  SELECT 1 FROM bookings WHERE tenant_id = NEW.tenant_id AND status = 'active'
   AND id <> NEW.id AND NEW.start_at < end_at AND NEW.end_at > start_at
 );
END;
--> statement-breakpoint
-- Guards run inside the statement's transaction, including writes outside the API.
CREATE TRIGGER bookings_guard_update BEFORE UPDATE ON bookings
WHEN NEW.status = 'active'
BEGIN
 SELECT RAISE(ABORT, 'inactive_reference') WHERE
  EXISTS(SELECT 1 FROM services WHERE tenant_id = NEW.tenant_id AND id = NEW.service_id AND active = 0) OR
  EXISTS(SELECT 1 FROM customers WHERE tenant_id = NEW.tenant_id AND id = NEW.customer_id AND active = 0);
 SELECT RAISE(ABORT, 'booking_overlap') WHERE EXISTS (
  SELECT 1 FROM bookings WHERE tenant_id = NEW.tenant_id AND status = 'active'
   AND id <> NEW.id AND NEW.start_at < end_at AND NEW.end_at > start_at
 );
END;
