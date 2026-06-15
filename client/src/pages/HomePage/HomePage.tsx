import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-lg px-6 text-center">
        <h1 className="text-4xl font-light tracking-tight text-primary">
          Hello, World
        </h1>
        <p className="mt-4 text-base font-normal text-muted-foreground">
          应用已就绪，开始构建你的想法
        </p>
      </div>
      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        h1 {
          animation: fade-in-up 800ms ease-out both;
        }

        p {
          animation: fade-in-up 800ms ease-out 200ms both;
        }

        @media (prefers-reduced-motion: reduce) {
          h1,
          p {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default HomePage;
