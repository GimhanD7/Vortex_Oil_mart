"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Mail, Phone, X } from "lucide-react";

type HelpSupportButtonProps = {
  className?: string;
  iconClassName?: string;
  children?: ReactNode;
};

export function HelpSupportButton({ className, iconClassName, children }: HelpSupportButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const modal = (
    <div className="support-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <section
        className="support-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span><CircleHelp size={22} aria-hidden="true" /></span>
            <div>
              <h2 id="support-title">Help &amp; Support</h2>
              <p>Contact Vortex Digital Labs for POS support.</p>
            </div>
          </div>
          <button type="button" aria-label="Close support" onClick={() => setOpen(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="support-contact-list">
          <a href="tel:+94775574145">
            <Phone size={18} aria-hidden="true" />
            <span>
              <small>Mobile Support</small>
              <b>077 557 4145</b>
            </span>
          </a>
          <a href="mailto:info.vortexdigitallabs@gmail.com">
            <Mail size={18} aria-hidden="true" />
            <span>
              <small>Email Support</small>
              <b>info.vortexdigitallabs@gmail.com</b>
            </span>
          </a>
        </div>

        <footer>
          <b>Vortex Digital Labs</b>
          <small>POS setup, troubleshooting, updates, and technical support.</small>
        </footer>
      </section>
    </div>
  );

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children || (
          <>
            <CircleHelp className={iconClassName} aria-hidden="true" strokeWidth={1.9} />
            <span>Help &amp; Support</span>
          </>
        )}
      </button>

      {mounted && open ? createPortal(modal, document.body) : null}
    </>
  );
}
