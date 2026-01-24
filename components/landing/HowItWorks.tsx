export function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Paste a YouTube URL',
      description: 'Copy any YouTube video link. Works with individual videos or entire playlists.',
    },
    {
      number: '2',
      title: 'Get the transcript',
      description: 'We extract the transcript instantly. Download as Markdown or save to your library.',
    },
    {
      number: '3',
      title: 'Chat with your videos',
      description: 'Ask questions in natural language. Get answers with timestamps linking back to the source.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-32 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            From YouTube URL to searchable knowledge in seconds
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-gray-200 lg:block" />
              )}
              <div className="relative flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-xl font-bold text-white">
                  {step.number}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-gray-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
