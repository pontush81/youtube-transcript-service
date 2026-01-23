import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 pt-8">
      {/* Logo and branding */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Transcript Service</h1>
        </div>
        <p className="text-gray-500">Skapa ett konto för att komma igång</p>
      </div>

      <SignUp
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
        path="/sign-up"
        signInUrl="/sign-in"
      />
    </div>
  );
}
