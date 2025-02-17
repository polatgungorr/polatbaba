/*
  # SMS Verification System

  1. New Tables
    - `verification_codes`
      - `id` (uuid, primary key)
      - `phone` (text, not null)
      - `code` (text, not null)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)

  2. Changes
    - Add `phone_verified` column to `profiles` table

  3. Security
    - Enable RLS on `verification_codes` table
    - Add policies for:
      - Reading own verification codes
      - Inserting verification codes
      - Deleting own verification codes
*/

CREATE TABLE IF NOT EXISTS verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own verification codes
CREATE POLICY "Users can read own verification codes"
  ON verification_codes
  FOR SELECT
  TO authenticated
  USING (phone IN (
    SELECT phone FROM profiles WHERE id = auth.uid()
  ));

-- Allow users to insert verification codes
CREATE POLICY "Users can insert verification codes"
  ON verification_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to delete their own verification codes
CREATE POLICY "Users can delete own verification codes"
  ON verification_codes
  FOR DELETE
  TO authenticated
  USING (phone IN (
    SELECT phone FROM profiles WHERE id = auth.uid()
  ));

-- Add phone_verified column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;