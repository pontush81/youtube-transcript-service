import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 pt-8">
      {/* Logo and branding */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
        </div>
        <p className="text-gray-500">Sign in to continue</p>
      </div>

      <SignIn
        appearance={{
          variables: {
            colorPrimary: '#2563eb',
            colorBackground: '#ffffff',
            colorText: '#111827',
            colorTextSecondary: '#6b7280',
            colorInputBackground: '#ffffff',
            colorInputText: '#111827',
            borderRadius: '0.75rem',
            fontFamily: 'inherit',
          },
          elements: {
            rootBox: 'mx-auto w-full max-w-md',
            card: 'shadow-xl border border-gray-200 rounded-2xl',
            headerTitle: 'text-xl font-semibold text-gray-900',
            headerSubtitle: 'text-gray-500',
            socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50 transition-colors',
            socialButtonsBlockButtonText: 'font-medium',
            formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 transition-colors',
            formFieldInput: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg',
            formFieldLabel: 'text-gray-700 font-medium',
            footerActionLink: 'text-blue-600 hover:text-blue-700 font-medium',
            dividerLine: 'bg-gray-200',
            dividerText: 'text-gray-400',
            footer: 'hidden',
          }
        }}
        routing="path"
        path="/sign-in"
      />
    </div>
  );
}
