import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HavDoxIntro } from "./HavDoxIntro";

interface BrandIntroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoPlay?: boolean;
}

/**
 * HavDox Official Breakthrough Intro Modal
 * 
 * Uses the pure code HavDoxIntro animation with vector breakthrough morph.
 */
export const BrandIntroModal: React.FC<BrandIntroModalProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-white text-black border border-[#E4E4E7] shadow-[0_24px_60px_rgba(0,0,0,0.25)] rounded-2xl">
        {/* Header bar inside modal */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-3 rounded-full text-xs font-medium bg-black/5 hover:bg-black/10 text-neutral-800 transition-colors"
          >
            Close
            <X className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        {/* Breakthrough Code-based Animation */}
        <div className="relative w-full aspect-video bg-white flex items-center justify-center overflow-hidden">
          {open && (
            <HavDoxIntro
              onAnimationComplete={() => {
                setTimeout(() => onOpenChange(false), 500);
              }}
              showContent={false}
            />
          )}
        </div>

        {/* Brand bar footer in modal */}
        <div className="px-6 py-3.5 bg-neutral-50/80 border-t border-neutral-200/80 flex items-center justify-between text-xs text-neutral-600">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-neutral-900">Drive Flow</span>
            <span>•</span>
            <span className="font-medium">HavDox</span>
          </div>
          <span className="text-xs text-neutral-400">
            Imagine. Build. Go Beyond.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BrandIntroModal;
