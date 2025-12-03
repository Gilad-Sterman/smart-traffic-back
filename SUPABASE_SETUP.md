# Supabase Database Setup

This document contains the SQL commands needed to set up the SmartTraffic database schema in Supabase.

## Environment Variables

Add these to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Authentication Configuration
REQUIRE_AUTH=false  # Set to 'true' for MVP mode
JWT_SECRET=your_jwt_secret_change_in_production
JWT_EXPIRES_IN=7d

# Other existing variables...
```

## Database Schema

Run these SQL commands in your Supabase SQL editor:

### 1. Users Table

```sql
-- Create users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'driver' CHECK (role IN ('driver', 'fleet_admin', 'lawyer', 'system_admin', 'guest')),
    phone VARCHAR(20),
    license_number VARCHAR(50),
    company_id UUID REFERENCES companies(id),
    subscription JSONB DEFAULT '{"type": "free", "status": "active"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 2. Companies Table (for Fleet Management)

```sql
-- Create companies table
CREATE TABLE companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    address JSONB,
    settings JSONB DEFAULT '{"autoUpload": false, "notifications": {"email": true, "whatsapp": false, "riskThreshold": 10}}',
    api_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on company name
CREATE INDEX idx_companies_name ON companies(name);
```

### 3. Reports Table

```sql
-- Create reports table
CREATE TABLE reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id),
    
    -- File Information
    original_file JSONB NOT NULL,
    
    -- OCR Results
    ocr_results JSONB,
    
    -- AI Analysis Results
    analysis_results JSONB,
    
    -- Appeal Information (MVP)
    appeal JSONB DEFAULT '{"status": "not_started", "letterGenerated": false}',
    
    -- Payment Information (MVP)
    payment JSONB DEFAULT '{"required": false, "status": "pending"}',
    
    -- Status and Metadata
    status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'ocr_processing', 'ocr_complete', 'ai_processing', 'complete', 'error')),
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_company_id ON reports(company_id) WHERE company_id IS NOT NULL;
```

### 4. Analytics Table

```sql
-- Create analytics table for system metrics
CREATE TABLE analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    metrics JSONB NOT NULL,
    performance JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on date for analytics queries
CREATE INDEX idx_analytics_date ON analytics(date);
```

### 5. Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Reports policies
CREATE POLICY "Users can view own reports" ON reports
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reports" ON reports
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reports" ON reports
    FOR UPDATE USING (user_id = auth.uid());

-- Company policies (for fleet management)
CREATE POLICY "Company admins can view company data" ON companies
    FOR SELECT USING (
        id IN (
            SELECT company_id FROM users 
            WHERE id = auth.uid() AND role IN ('fleet_admin', 'system_admin')
        )
    );

-- Analytics policies (admin only)
CREATE POLICY "System admins can view analytics" ON analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'system_admin'
        )
    );
```

### 6. Functions and Triggers

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Installation Steps

1. **Create Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project
2. **Get API Keys**: Copy your project URL, anon key, and service role key
3. **Update Environment**: Add the keys to your `.env` file
4. **Run SQL Schema**: Execute all the SQL commands above in your Supabase SQL editor
5. **Install Dependencies**: Run `npm install` in your backend directory
6. **Test Connection**: Start your server and check the health endpoint

## PoC vs MVP Mode

- **PoC Mode** (`REQUIRE_AUTH=false`): All requests use the guest user automatically
- **MVP Mode** (`REQUIRE_AUTH=true`): Requires authentication for all operations

## Guest User

The system uses a hardcoded guest user for PoC mode:
- ID: `00000000-0000-0000-0000-000000000000`
- Email: `guest@smarttraffic.local`
- Role: `guest`

This user doesn't exist in the database but is handled by the application logic.

## API Endpoints

### Authentication (MVP Mode Only)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile
- `GET /api/auth/status` - Check auth status
- `POST /api/auth/logout` - Logout user

### Reports (Both PoC and MVP)
- `POST /api/upload/document` - Upload document
- `POST /api/upload/analyze/:reportId` - Analyze document
- `GET /api/upload/results/:reportId` - Get analysis results
- `GET /api/upload/reports` - Get user's reports list

All report endpoints automatically work with guest user in PoC mode or authenticated user in MVP mode.
