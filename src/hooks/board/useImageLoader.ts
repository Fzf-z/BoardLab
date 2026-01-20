import { useState, useEffect, useCallback, ChangeEvent, RefObject } from 'react';

interface UseImageLoaderOptions {
    containerRef: RefObject<HTMLDivElement>;
    onFitToContainer: (width: number, height: number) => void;
    onReset: () => void;
}

export function useImageLoader({ containerRef, onFitToContainer, onReset }: UseImageLoaderOptions) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imageSrcB, setImageSrcB] = useState<string | null>(null);
    const [imageAWidth, setImageAWidth] = useState<number>(0);
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    const setImage = useCallback((src: string | null, srcB: string | null = null) => {
        setImageSrc(src);
        setImageSrcB(srcB);
        onReset();
    }, [onReset]);

    useEffect(() => {
        if (imageSrc && containerRef.current) {
            const imgA = new Image();

            const processDimensions = (widthA: number, heightA: number, widthB: number = 0, heightB: number = 0) => {
                setTimeout(() => {
                    const container = containerRef.current;
                    if (!container) return;

                    const gap = widthB > 0 ? 48 : 0;
                    const totalWidth = widthA + gap + widthB;
                    const totalHeight = Math.max(heightA, heightB);

                    setImageDimensions({ width: totalWidth, height: totalHeight });
                    setImageAWidth(widthA);

                    onFitToContainer(totalWidth, totalHeight);
                }, 0);
            };

            imgA.onload = () => {
                if (imageSrcB) {
                    const imgB = new Image();
                    imgB.onload = () => {
                        processDimensions(imgA.naturalWidth, imgA.naturalHeight, imgB.naturalWidth, imgB.naturalHeight);
                    };
                    imgB.src = imageSrcB;
                } else {
                    processDimensions(imgA.naturalWidth, imgA.naturalHeight);
                }
            };
            imgA.src = imageSrc;
        }
    }, [imageSrc, imageSrcB, containerRef, onFitToContainer]);

    const handleImageUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setImage(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    }, [setImage]);

    return {
        imageSrc,
        imageSrcB,
        imageAWidth,
        imageDimensions,
        setImage,
        handleImageUpload
    };
}
