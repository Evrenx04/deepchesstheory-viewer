/**
 * The "tell me when it opens" list: a MailerLite embedded form ("Site formu", group "Kurs Açılışı", double opt-in).
 * The page posts to the form's endpoint itself, so the form keeps the site's own look; the endpoint allows any origin.
 */
const ENDPOINT = "https://assets.mailerlite.com/jsonp/2745809/forms/202464568058840112/subscribe";

/** Sends the address; MailerLite then emails a confirmation link, and only a confirmed address joins the list. */
export async function subscribe(email: string): Promise<void> {
  const body = new URLSearchParams({ "fields[email]": email, "ml-submit": "1", anticsrf: "true" });
  const res = await fetch(ENDPOINT, { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!res.ok || !data.success) throw new Error(`MailerLite: ${res.status}`);
}
