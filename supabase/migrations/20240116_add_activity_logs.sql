-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_email ON activity_logs(user_email);

-- Add GIN index for JSONB details column for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_details ON activity_logs USING GIN (details);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to view activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create a function to automatically log activities
CREATE OR REPLACE FUNCTION log_activity(
  p_action VARCHAR,
  p_user_id UUID DEFAULT NULL,
  p_user_email VARCHAR DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO activity_logs (action, user_id, user_email, details)
  VALUES (p_action, p_user_id, p_user_email, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON TABLE activity_logs IS 'Stores system activity logs for audit trail';
COMMENT ON FUNCTION log_activity IS 'Helper function to log activities';

-- Create view for activity logs with user information
CREATE OR REPLACE VIEW activity_logs_with_users AS
SELECT 
  al.*,
  p.full_name as user_full_name,
  p.email as user_profile_email
FROM activity_logs al
LEFT JOIN profiles p ON al.user_id = p.id
ORDER BY al.created_at DESC;

-- Grant access to the view
GRANT SELECT ON activity_logs_with_users TO authenticated;
