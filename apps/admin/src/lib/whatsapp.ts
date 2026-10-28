import nodemailer from "nodemailer";

/**
 * WhatsApp notification service for platform guidance.
 *
 * Uses Twilio WhatsApp API to send onboarding/guidance messages
 * with direct links to each menu/feature of the platform.
 *
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and
 * TWILIO_WHATSAPP_FROM (e.g., "whatsapp:+14155238886")
 * environment variables to be set.
 */

export type WhatsAppMessage = {
  to: string;
  body: string;
  mediaUrl?: string;
};

export type PlatformGuideLink = {
  label: string;
  url: string;
  description: string;
};

// Platform menu guides with direct links
export const PLATFORM_GUIDES: Record<string, PlatformGuideLink[]> = {
  sme: [
    { label: "Sales Dashboard", url: "/sme/sales", description: "Track sales, view forecasts and trends" },
    { label: "Inventory", url: "/sme/inventory", description: "Manage products and stock levels" },
    { label: "Customers", url: "/sme/customers", description: "View and manage customer records" },
    { label: "Suppliers", url: "/sme/suppliers", description: "Manage supplier relationships" },
    { label: "Loans", url: "/sme/loans", description: "Apply for and manage loans" },
    { label: "Savings", url: "/sme/savings", description: "View savings accounts and transactions" },
    { label: "Sales Pilot", url: "/apps", description: "Access advanced analytics and forecasting" },
  ],
  supplier: [
    { label: "Supplier Dashboard", url: "/supplier", description: "View supplier overview and orders" },
    { label: "Orders", url: "/supplier/orders", description: "Manage incoming orders" },
    { label: "Products", url: "/supplier/products", description: "Manage product catalog" },
  ],
  customer: [
    { label: "Customer Portal", url: "/customer", description: "View purchases and account" },
    { label: "Payments", url: "/customer/payments", description: "Make and track payments" },
  ],
  admin: [
    { label: "Admin Dashboard", url: "/admin", description: "Platform administration" },
    { label: "SMEs", url: "/admin/smes", description: "Manage SME tenants" },
    { label: "Plans", url: "/admin/plans", description: "Manage subscription plans" },
    { label: "Users", url: "/admin/users", description: "Manage platform users" },
  ],
  pos: [
    { label: "POS Terminal", url: "/pos", description: "Run the till and process sales" },
    { label: "Stock", url: "/pos/stock", description: "Manage stock levels" },
    { label: "Receipts", url: "/pos/receipts", description: "View and print receipts" },
  ],
  neobank: [
    { label: "Neobank Dashboard", url: "/neobank", description: "View accounts and balances" },
    { label: "Accounts", url: "/neobank/accounts", description: "Manage bank accounts" },
    { label: "Cards", url: "/neobank/cards", description: "Manage virtual cards" },
    { label: "Crypto", url: "/neobank/crypto", description: "Buy/sell crypto" },
    { label: "Investments", url: "/neobank/investments", description: "Investment portfolio" },
    { label: "Insurance", url: "/neobank/insurance", description: "Insurance products" },
    { label: "Lending", url: "/neobank/lending", description: "Loan applications" },
  ],
};

/**
 * Build a WhatsApp-friendly HTML guide message for a given role.
 */
export function buildPlatformGuideMessage(role: string, baseUrl: string): string {
  const guides = PLATFORM_GUIDES[role.toLowerCase()] || PLATFORM_GUIDES.sme;
  const lines = [
    `Welcome to Kora! 🎉`,
    ``,
    `Here's how to navigate your platform:`,
    ``,
  ];

  for (const guide of guides) {
    lines.push(`📌 ${guide.label}`);
    lines.push(`   ${guide.description}`);
    lines.push(`   🔗 ${baseUrl}${guide.url}`);
    lines.push(``);
  }

  lines.push(`Need help? Reply to this message or visit ${baseUrl}/help`);
  lines.push(``);
  lines.push(`— Kora by Kora Systems`);

  return lines.join("\n");
}

/**
 * Send a WhatsApp message via Twilio.
 */
export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    console.log("[whatsapp:simulated]", JSON.stringify(message));
    return { success: true, messageId: `sim-${Date.now()}` };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append("From", from);
    params.append("To", `whatsapp:${message.to}`);
    params.append("Body", message.body);
    if (message.mediaUrl) {
      params.append("MediaUrl", message.mediaUrl);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, messageId: data.sid };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send a platform guide to a user via WhatsApp.
 */
export async function sendPlatformGuide(
  phone: string,
  role: string,
  baseUrl: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = buildPlatformGuideMessage(role, baseUrl);
  return sendWhatsAppMessage({ to: phone, body: message });
}