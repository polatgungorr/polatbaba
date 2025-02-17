/*
  # Update verification codes policies

  1. Changes
    - Remove authentication requirement for verification codes
    - Allow public access for insert and select operations
    - Keep delete operation restricted to authenticated users

  2. Security
    - Enable public access for verification code creation and verification
    - Maintain secure deletion policy
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Users can insert verification codes" ON verification_codes;

-- Create new policies
CREATE POLICY "Anyone can insert verification codes"
  ON verification_codes
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read verification codes"
  ON verification_codes
  FOR SELECT
  TO public
  USING (true);