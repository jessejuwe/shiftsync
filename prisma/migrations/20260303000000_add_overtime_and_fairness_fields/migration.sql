-- Add hourly rate to Location for overtime cost projection
ALTER TABLE "locations" ADD COLUMN "hourly_rate" DOUBLE PRECISION;

-- Add desired hours per week to User for fairness analytics
ALTER TABLE "users" ADD COLUMN "desired_hours_per_week" DOUBLE PRECISION;
