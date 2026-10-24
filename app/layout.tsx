import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
export const metadata: Metadata = {
  title: {
    default: "AGI One · Business Operations",
    template: "%s · AGI One",
  },
  description:
    "AGI One connects customer relationships, sales, service and business operations.",
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
