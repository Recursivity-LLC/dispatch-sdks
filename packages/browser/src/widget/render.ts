import { type ButtonPosition, STYLES, buttonStyle } from "./styles";

// The DOM nodes the controller wires up. This is the JS rebuild of _widget.html.erb — the gem
// kept the markup in an ERB partial, so "porting widget.js" really means recreating this tree.
export interface WidgetRefs {
  root: HTMLDivElement;
  button: HTMLButtonElement;
  modal: HTMLDivElement;
  dropzone: HTMLDivElement;
  description: HTMLTextAreaElement;
  fileInput: HTMLInputElement;
  attachButton: HTMLButtonElement;
  previews: HTMLDivElement;
  error: HTMLDivElement;
  submit: HTMLButtonElement;
  toast: HTMLDivElement;
  closeButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
}

export function buildWidgetDom(doc: Document, position: ButtonPosition): WidgetRefs {
  const root = doc.createElement("div");
  // Marker so the click-path tracker can ignore clicks inside the widget itself.
  root.setAttribute("data-dispatch-widget", "");

  const button = doc.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Send feedback");
  button.style.cssText = buttonStyle(position);
  button.textContent = "💬";

  const modal = doc.createElement("div");
  modal.hidden = true;
  modal.style.cssText = STYLES.modal;

  const dropzone = doc.createElement("div");
  dropzone.style.cssText = STYLES.card;

  const header = doc.createElement("div");
  header.style.cssText = STYLES.header;
  const h2 = doc.createElement("h2");
  h2.textContent = "SEND FEEDBACK";
  h2.style.cssText = STYLES.h2;
  const closeButton = doc.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.style.cssText = STYLES.closeX;
  header.append(h2, closeButton);

  const hint = doc.createElement("p");
  hint.textContent =
    "Found a bug, want a feature, or think something should work differently? Tell us. We'll capture the URL, browser, and environment automatically.";
  hint.style.cssText = STYLES.hint;

  const description = doc.createElement("textarea");
  description.rows = 5;
  description.placeholder =
    "When I clicked Save, the page returned a 500… or: It'd be great if I could export this list as CSV.";
  description.style.cssText = STYLES.textarea;

  const fileInput = doc.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg,image/gif,image/webp";
  fileInput.multiple = true;
  fileInput.hidden = true;

  const attachRow = doc.createElement("div");
  attachRow.style.cssText = STYLES.attachRow;
  const attachButton = doc.createElement("button");
  attachButton.type = "button";
  attachButton.textContent = "📎 Attach screenshots (0/5)";
  attachButton.style.cssText = STYLES.attachButton;
  const attachHint = doc.createElement("span");
  attachHint.textContent = "or paste / drag & drop · max 5, 5 MB each";
  attachHint.style.cssText = STYLES.attachHint;
  attachRow.append(attachButton, attachHint);

  const previews = doc.createElement("div");
  previews.style.cssText = STYLES.previews;

  const error = doc.createElement("div");
  error.style.cssText = STYLES.error;

  const footer = doc.createElement("div");
  footer.style.cssText = STYLES.footer;
  const cancelButton = doc.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.style.cssText = STYLES.cancelButton;
  const submit = doc.createElement("button");
  submit.type = "button";
  submit.textContent = "Send";
  submit.style.cssText = STYLES.reportButton;
  footer.append(cancelButton, submit);

  dropzone.append(header, hint, description, fileInput, attachRow, previews, error, footer);
  modal.append(dropzone);

  const toast = doc.createElement("div");
  toast.hidden = true;
  toast.textContent = "✓ Feedback sent. Thanks!";
  toast.style.cssText = STYLES.toast;

  root.append(button, modal, toast);

  return {
    root,
    button,
    modal,
    dropzone,
    description,
    fileInput,
    attachButton,
    previews,
    error,
    submit,
    toast,
    closeButton,
    cancelButton,
  };
}
