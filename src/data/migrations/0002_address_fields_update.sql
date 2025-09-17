-- Migration: address fields update
-- Created at: 2023-09-17T00:00:00Z
-- Description: Add name, phone, and landmark fields to addresses table

-- Modify addresses table to add new fields
ALTER TABLE addresses ADD COLUMN name TEXT;
ALTER TABLE addresses ADD COLUMN phone TEXT;
ALTER TABLE addresses ADD COLUMN landmark TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_addresses_address_type ON addresses (address_type);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON addresses (is_default);