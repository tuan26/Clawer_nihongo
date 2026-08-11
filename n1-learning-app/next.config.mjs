/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rikkeiedu-storage.s3.ap-southeast-2.amazonaws.com',
      },
    ],
  },
  // App không có trang đăng nhập riêng: form đăng nhập do AuthGuard render ngay
  // tại '/' khi chưa có session. Đưa /login về '/' để bookmark hoặc thói quen gõ
  // tay không rơi vào trang 404.
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
