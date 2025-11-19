import { Hono } from "hono";
import { subscribeEmailToSns } from "../config/sns.js";

const notifications = new Hono();

notifications.post("/subscribe", async (c) => {
  const body = await c.req.json();
  const email = body.email;

  // Validación básica de email
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return c.json({ error: "Valid email required" }, 400);
  }

  try {
    await subscribeEmailToSns(email);
    return c.json({ message: "Subscription request sent. Check your email." });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Failed to subscribe email" }, 500);
  }
});

export default notifications;