import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "云漫武理｜武汉理工大学余家头校区",
  description: "通过高斯泼溅三维扫描与校园景点图文，在线探索武汉理工大学校园风光。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
