import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Sparkles, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface LoginForm {
  email: string;
  password: string;
}

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (error) {
      // Error handling is done in the store
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-primary-600 rounded-xl">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('auth.login')}</h1>
            <p className="text-gray-600 mt-2">登录您的AI网站构建器账户</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.email')}
              </label>
              <input
                {...register('email', {
                  required: t('auth.emailRequired'),
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: t('validation.emailInvalid'),
                  },
                })}
                type="email"
                autoComplete="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="请输入邮箱"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  {...register('password', {
                    required: t('auth.passwordRequired'),
                    minLength: {
                      value: 6,
                      message: t('validation.passwordTooShort'),
                    },
                  })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">登录中...</span>
                </>
              ) : (
                t('auth.signIn')
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('auth.noAccount')}{' '}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                {t('auth.signUp')}
              </Link>
            </p>
          </div>

          {/* Demo Info */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">演示账户</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p>邮箱: demo@example.com</p>
              <p>密码: demo123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};