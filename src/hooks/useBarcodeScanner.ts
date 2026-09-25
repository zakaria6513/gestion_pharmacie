import { useEffect, useRef } from 'react';

export const useBarcodeScanner = (onScan: (barcode: string) => void) => {
    const buffer = useRef<string>('');
    const lastKeyTime = useRef<number>(0);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if the user is holding down modifier keys (shortcuts)
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            
            // If the user is explicitly focused on an input, textarea, or select,
            // let the native input handle it (like the search bar which already catches Enter).
            const target = e.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                return;
            }

            const currentTime = Date.now();
            
            // Barcode scanners type very quickly. 100ms gap is safe for almost all scanners.
            if (currentTime - lastKeyTime.current > 100) {
                buffer.current = '';
            }

            if (e.key === 'Enter') {
                // If it's a valid barcode length and ends with enter
                if (buffer.current.length >= 2) {
                    const scannedCode = buffer.current;
                    buffer.current = ''; // Reset
                    
                    e.preventDefault();
                    onScan(scannedCode);
                }
            } else if (e.key.length === 1) { 
                // Capture printable single characters
                buffer.current += e.key;
            }

            lastKeyTime.current = currentTime;
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onScan]);
};
