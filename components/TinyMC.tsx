"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

const TinyMCEEditor = dynamic(
  async () => (await import("@tinymce/tinymce-react")).Editor,
  { ssr: false }
);

interface TinymceEditorProps {
  placeholder?: string;
  initialValue?: string;
  onContentChange?: (content: string) => void;
  height?: string | number;
}

const TinymceEditor: React.FC<TinymceEditorProps> = ({
  placeholder = "Start typing...",
  initialValue = "",
  onContentChange,
  height = "300px",
}) => {
  const [content, setContent] = useState(initialValue);

  const handleChange = (value: string) => {
    setContent(value);
    onContentChange?.(value);
  };

  return (
    <div style={{ height }}>
      <TinyMCEEditor
        apiKey="ojfr13shvq71zrs8u3y10vyx0ddwz1od1vozyjtcfcl17ylt"
        value={content}
        onEditorChange={handleChange}
        init={{
          height,
          menubar: false,
          plugins: [
            "advlist",
            "autolink",
            "lists",
            "link",
            "charmap",
            "preview",
            "anchor",
            "searchreplace",
            "visualblocks",
            "code",
            "fullscreen",
            "insertdatetime",
            "table",
            "help",
            "wordcount",
          ],
          toolbar:
            "undo redo | blocks | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link table | removeformat | help",
          placeholder,
        }}
      />
    </div>
  );
};

export default TinymceEditor;
