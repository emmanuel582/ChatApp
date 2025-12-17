
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://gmexguemikabfvoirlwg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtZXhndWVtaWthYmZ2b2lybHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjI0NjksImV4cCI6MjA4MDkzODQ2OX0.9IsRqo5uf-FZamORvMB0E3mkFmqxaWB4QN-VSbFppi4';

const PUBLIC_VAPID_KEY = 'BBZYM5uX9RvLdWH0ATTNjLVlV2Rs7tEuYWpCp-wcbyVFFDqz26hhfGytGaxH5ZqA48eIYOLWvoEaEhyFkEIkHH0';
const PRIVATE_VAPID_KEY = '4nYlt-BhQ6FSgLimC1jihuGoOv1DAeaR0z4XUtnNRJU';

webpush.setVapidDetails(
    'mailto:admin@chatapp.com',
    PUBLIC_VAPID_KEY,
    PRIVATE_VAPID_KEY
);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testPush() {
    console.log("Fetching latest subscription...");

    // Get the most recent subscription
    const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        console.error("No subscriptions found! error:", error);
        console.log("Please open the app in your browser to subscribe first.");
        return;
    }

    console.log("Found subscription for user:", data.user_id);

    const payload = JSON.stringify({
        title: 'Test Notification',
        body: 'This is a test from the manual script! 🚀',
        url: 'http://localhost:5173'
    });

    try {
        await webpush.sendNotification(data.subscription, payload);
        console.log("✅ Success! Notification sent.");
    } catch (err) {
        console.error("❌ Failed to send notification:", err);
    }
}

testPush();
