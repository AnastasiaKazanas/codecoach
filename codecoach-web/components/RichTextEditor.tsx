"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";

type Props = {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  placeholder?: string;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

export default function RichTextEditor({ valueHtml, onChangeHtml, placeholder }: Props) {
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const lastAppliedHtmlRef = useRef<string>("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,

      // ✅ Color needs TextStyle
      TextStyle,
      Color,

      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
      }),

      Image.configure({
        inline: false,
        allowBase64: true,
      }),

      Placeholder.configure({
        placeholder: placeholder ?? "Write assignment instructions…",
      }),
    ],
    content: valueHtml || "<p></p>",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastAppliedHtmlRef.current = html;
      onChangeHtml(html);
    },
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none min-h-[320px] p-4", // ✅ bigger box
      },
    },
  });

  useEffect(() => {
  if (!editor) return;

  const incoming = valueHtml || "<p></p>";
  const current = editor.getHTML();

  if (incoming === current) return;
  if (incoming === lastAppliedHtmlRef.current) return;

  editor.commands.setContent(incoming);

}, [editor, valueHtml]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Paste link URL", prev ?? "");
    if (url === null) return;

    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]);

  const onPickImage = useCallback(() => {
    imgInputRef.current?.click();
  }, []);

  const onImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      if (!file || !editor) {
        input.value = "";
        return;
      }

      const dataUrl = await fileToDataUrl(file);
      editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();

      // ✅ reset so same file can be selected again
      input.value = "";
    },
    [editor]
  );

  if (!editor) {
    return <div className="text-sm text-black/60">Loading editor…</div>;
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b border-black/10 p-2">
        <button
          type="button"
          className="px-2 py-1 rounded-lg border border-black/10"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded-lg border border-black/10"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded-lg border border-black/10"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </button>

        <button
          type="button"
          className="px-2 py-1 rounded-lg border border-black/10"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded-lg border border-black/10"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>

        <button type="button" className="px-2 py-1 rounded-lg border border-black/10" onClick={setLink}>
          Link
        </button>

        <button type="button" className="px-2 py-1 rounded-lg border border-black/10" onClick={onPickImage}>
          Image
        </button>

        <div className="ml-auto flex gap-1">
          <button
            type="button"
            className="px-2 py-1 rounded-lg border border-black/10"
            onClick={() => editor.chain().focus().undo().run()}
          >
            Undo
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded-lg border border-black/10"
            onClick={() => editor.chain().focus().redo().run()}
          >
            Redo
          </button>
        </div>

        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}