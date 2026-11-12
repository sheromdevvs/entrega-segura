"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
export function MessageComposer({
  busy,
  onSend,
  onError,
  code,
  preset,
}: {
  busy: boolean;
  onSend: (text: string, photo?: string) => Promise<void>;
  onError: (message: string) => void;
  code?: string;
  preset?: string;
}) {
  const [text, setText] = useState(""),
    [photo, setPhoto] = useState<string>(),
    [photoName, setPhotoName] = useState(""),
    [transcribing, setTranscribing] = useState(false),
    [recording, setRecording] = useState(false),
    [audioUrl, setAudioUrl] = useState<string>();
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    photoInput = useRef<HTMLInputElement>(null),
    audioInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (preset) setText(preset);
  }, [preset]);
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );
  async function transcribe(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      onError("La nota de voz puede pesar hasta 10 MB.");
      return;
    }
    setTranscribing(true);
    setAudioUrl(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.set("audio", file);
      const r = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setText(d.text);
    } catch (e) {
      onError(
        e instanceof Error ? e.message : "No se pudo transcribir la nota.",
      );
    } finally {
      setTranscribing(false);
    }
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      if (!navigator.mediaDevices || typeof MediaRecorder === "undefined")
        throw new Error(
          "Este navegador no permite grabar. Puede adjuntar una nota de voz.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const rec = new MediaRecorder(stream.current);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        const mime = rec.mimeType || "audio/webm",
          extension = mime.includes("mp4") ? "m4a" : "webm";
        void transcribe(new File(chunks, `nota.${extension}`, { type: mime }));
      };
      rec.start();
      setRecording(true);
    } catch (e) {
      onError(
        e instanceof Error ? e.message : "No se pudo abrir el micrófono.",
      );
    }
  }
  function attach(file: File | undefined) {
    if (!file) return;
    if (
      file.size > 5 * 1024 * 1024 ||
      !/^image\/(png|jpeg|webp)$/.test(file.type)
    ) {
      onError("Adjunte una imagen PNG, JPG o WebP de hasta 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  }
  return (
    <div className="composer">
      <div className="composer-suggestions">
        <button
          type="button"
          onClick={() =>
            setText(`Ya entregué el pedido. El código es ${code || "4821"}.`)
          }
        >
          Entrega + código
        </button>
        <button
          type="button"
          onClick={() => setText("No había nadie en casa. Dejé un aviso.")}
        >
          Cliente ausente
        </button>
        <button
          type="button"
          onClick={() =>
            setText("El producto llegó roto. Adjunto una foto del daño.")
          }
        >
          Reportar defecto
        </button>
      </div>
      <label className="sr-only" htmlFor="delivery-message">
        Mensaje del comprador o repartidor
      </label>
      <textarea
        id="delivery-message"
        value={text}
        maxLength={3000}
        onChange={(e) => setText(e.target.value)}
        placeholder="Cuéntenos qué pasó en la entrega…"
        disabled={busy || transcribing}
      />
      {photo && (
        <div className="attachment-preview">
          <img src={photo} alt="Imagen adjunta para revisión de la entrega" />
          <span>{photoName}</span>
          <button
            className="icon-button"
            onClick={() => {
              setPhoto(undefined);
              setPhotoName("");
              if (photoInput.current) photoInput.current.value = "";
            }}
            aria-label="Quitar imagen"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {audioUrl && <audio className="recorded-audio" controls src={audioUrl} />}
      <div className="composer-footer">
        <div className="composer-tools">
          <input
            hidden
            ref={photoInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => attach(e.target.files?.[0])}
          />
          <input
            hidden
            ref={audioInput}
            type="file"
            accept="audio/*"
            onChange={(e) => {
              if (e.target.files?.[0]) void transcribe(e.target.files[0]);
            }}
          />
          <button
            className="icon-button"
            type="button"
            aria-label="Adjuntar imagen"
            title="Adjuntar imagen"
            onClick={() => photoInput.current?.click()}
            disabled={busy}
          >
            <Icon name="image" size={18} />
          </button>
          <button
            className={`icon-button ${recording ? "is-recording" : ""}`}
            type="button"
            aria-label={recording ? "Detener grabación" : "Grabar nota de voz"}
            title={recording ? "Detener grabación" : "Grabar nota de voz"}
            onClick={record}
            disabled={busy || transcribing}
          >
            <Icon name={recording ? "stop" : "mic"} size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Adjuntar nota de voz"
            title="Adjuntar nota de voz"
            onClick={() => audioInput.current?.click()}
            disabled={busy || transcribing}
          >
            <Icon name="attach" size={18} />
          </button>
          <span className="composer-status" role="status">
            {recording
              ? "Grabando…"
              : transcribing
                ? "Transcribiendo…"
                : "Texto, voz o imagen"}
          </span>
        </div>
        <button
          className="button button-black button-send"
          disabled={busy || transcribing || recording || !text.trim()}
          onClick={async () => {
            await onSend(text, photo);
          }}
        >
          {busy ? (
            <span className="spinner" />
          ) : (
            <Icon name="arrow" size={18} />
          )}
          <span>{busy ? "Interpretando" : "Interpretar"}</span>
        </button>
      </div>
      <div className="composer-disclosure">
        El modelo interpreta el mensaje. Una regla separada decide el siguiente
        paso.
      </div>
    </div>
  );
}
