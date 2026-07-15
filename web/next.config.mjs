/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Дозволяємо зовнішні фото: CDN dom.ria, Supabase Storage, плейсхолдери Google.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.riastatic.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
