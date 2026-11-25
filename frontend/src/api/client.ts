const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
const LOCAL_ONLY = import.meta.env.VITE_LOCAL_ONLY === "true";

export type UploadResponse = {
  fileKey: string;
  url: string;
  filename: string;
  size: number;
  mime: string;
};

export async function uploadImage(file: File): Promise<UploadResponse> {
  if (LOCAL_ONLY) {
    return {
      fileKey: `local-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      url: URL.createObjectURL(file),
      filename: file.name,
      size: file.size,
      mime: file.type,
    };
  }

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/uploads`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "上傳失敗");
  }
  return res.json();
}

