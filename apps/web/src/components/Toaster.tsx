import { Toaster as SonnerToaster } from 'sonner';

export const Toaster = () => {
    return (
        <SonnerToaster
            theme="dark"
            position="top-right"
            toastOptions={{
                style: {
                    background: 'var(--sori-surface-main)',
                    border: '1px solid var(--sori-border-subtle)',
                    color: 'var(--sori-text-primary)',
                    fontFamily: 'Inter, sans-serif',
                    borderRadius: '12px',
                },
                className: 'sori-toast',
            }}
        />
    );
};
