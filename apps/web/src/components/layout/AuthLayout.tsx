import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rss } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 bg-gradient-to-br from-accent-500 to-accent-700">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-white text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Rss className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4">a-RSS</h1>
          <p className="text-lg text-white/80 max-w-md">
            Another RSS Software Solution. A modern, beautiful RSS reader focused on UI/UX excellence.
          </p>
        </motion.div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-accent-500 flex items-center justify-center mr-3">
              <Rss className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">a-RSS</span>
          </div>
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
