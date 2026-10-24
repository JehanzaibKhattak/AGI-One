import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
export const metadata: Metadata = {
  title: {
    default: "AMSS One · Business Operations",
    template: "%s · AMSS One",
  },
  description:
    "A connected business workspace for AM Sales & Services. CRM, sales, inventory, field service, and finance.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
