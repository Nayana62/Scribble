import { useEffect, useState } from "react";

/**
 * Tracks the distance from the layout viewport bottom to the visual viewport
 * bottom (keyboard height on iOS Safari). Used to lift fixed bottom UI above
 * the on-screen keyboard without reflowing content above.
 */
export function useVisualViewport() {
  const [offset, setOffset] = useState(0);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    setSupported(true);

    const handleResize = () => {
      const keyboardOffset = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(Math.max(0, keyboardOffset));
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    handleResize();

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  return { offset, supported };
}
