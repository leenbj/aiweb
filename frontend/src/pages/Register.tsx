import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Sparkles, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const Register: React.FC = () => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>();

  const password = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(data.name, data.email, data.password);
      navigate('/');
    } catch (error) {
      // Error handling is done in the store
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-primary-600 rounded-xl">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('auth.createAccount')}</h1>
            <p className="text-gray-600 mt-2">加入AI网站构建器</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.name')}
              </label>
              <input
                {...register('name', {
                  required: t('auth.nameRequired'),
                  minLength: {
                    value: 2,
                    message: '姓名至少需要2个字符',
                  },
                })}
                className={`input ${errors.name ? 'input-error' : ''}`}
                placeholder="请输入您的姓名"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="请输入邮箱"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="请创建密码"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.confirmPassword')}
              </label>
              <input
                {...register('confirmPassword', {
                  required: '请确认您的密码',
                  validate: (value) =>
                    value === password || t('auth.passwordMismatch'),
                })}
                type="password"
                className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
                placeholder="请确认密码"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
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
                  <span className="ml-2">创建账户中...</span>
                </>
              ) : (
                t('auth.createAccount')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link
                to="/login"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                {t('auth.signIn')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};