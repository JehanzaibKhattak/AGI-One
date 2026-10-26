import nodemailer from "nodemailer";
import { mkdir, writeFile, lstat, chmod } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
export const mailPreviewDirectory = join(tmpdir(), "agi-one-mail");
export function mailConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.AUTH_MAIL_MODE === "preview") {
    const hostname = new URL(env.BETTER_AUTH_URL || "https://invalid").hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname))
      throw new Error(
        "Email preview is allowed only with a loopback BETTER_AUTH_URL. Configure SMTP for deployed environments.",
      );
    return { mode: "preview" as const };
  }
  if (
    env.AUTH_MAIL_MODE !== "smtp" ||
    !env.SMTP_HOST ||
    !env.SMTP_FROM ||
    /[\r\n]/.test(env.SMTP_FROM)
  )
    throw new Error(
      "Configure AUTH_MAIL_MODE=smtp, SMTP_HOST and SMTP_FROM, or explicitly use preview for local development.",
    );
  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid SMTP_PORT.");
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD))
    throw new Error("Configure both SMTP_USER and SMTP_PASSWORD.");
  return {
    mode: "smtp" as const,
    from: env.SMTP_FROM,
    options: {
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      logger: false as const,
      debug: false,
    },
  };
}
export async function sendAccountMail(
  to: string,
  subject: string,
  text: string,
) {
  const config = mailConfiguration();
  if (config.mode === "preview") {
    await mkdir(mailPreviewDirectory, { recursive: true, mode: 0o700 });
    const directory = await lstat(mailPreviewDirectory);
    if (
      directory.isSymbolicLink() ||
      !directory.isDirectory() ||
      (process.getuid && directory.uid !== process.getuid())
    )
      throw new Error(
        "Email preview directory must be a private directory owned by this user.",
      );
    await chmod(mailPreviewDirectory, 0o700);
    await writeFile(
      join(mailPreviewDirectory, randomUUID() + ".json"),
      JSON.stringify({
        to,
        subject,
        text,
        createdAt: new Date().toISOString(),
      }),
      { mode: 0o600, flag: "wx" },
    );
    return;
  }
  try {
    await nodemailer
      .createTransport(config.options)
      .sendMail({ from: config.from, to, subject, text });
  } catch {
    throw new Error(
      "Account email could not be delivered. Check the configured SMTP service.",
    );
  }
}
