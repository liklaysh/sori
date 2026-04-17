import { Toaster as SonnerToaster } from 'sonner';

export const Toaster = () => {
    return (
        <SonnerToaster
            theme="dark"
            position="top-right"
            toastOptions={{
                style: {
                    background: 'rgba(50, 51, 56, 0.8)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontFamily: 'Inter, sans-serif',
                },
                className: 'sori-toast',
            }}
        />
    );
};
