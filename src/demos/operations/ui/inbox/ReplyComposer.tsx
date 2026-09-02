"use client";

/**
 * Operations demo: the reply composer.
 *
 * A textarea and a button. There is no recipient field, no channel address, no
 * attachment and no formatting, because none of those things could mean
 * anything: a reply appends a record to a local store and nothing leaves the
 * browser.
 *
 * Enter inserts a newline. Hijacking it to send is a messenger convention, and
 * this is a work surface where a reply is written before it is sent (D-080).
 */

import { useId, useRef, useState } from "react";

/** Long enough for a real operational reply, short enough to stay readable. */
const REPLY_LIMIT = 600;

/**
 * Keyed on the conversation by its caller, so a different thread remounts this
 * and the draft goes with it. A `useEffect` that cleared the field would do the
 * same thing one cascading render later, which is what React means when it says
 * you might not need an effect.
 */
type Props = {
  pending: boolean;
  error: string | null;
  onSend: (body: string) => Promise<boolean>;
};

export default function ReplyComposer({ pending, error, onSend }: Props) {
  const ids = useId();
  const [body, setBody] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const empty = body.trim().length === 0;
  const errorId = `${ids}-error`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending || empty) return;
    const sent = await onSend(body);
    if (sent) {
      setBody("");
      areaRef.current?.focus();
    }
  };

  return (
    <form className="ops-composer" onSubmit={submit} noValidate>
      <label className="ops-composer__label" htmlFor={`${ids}-body`}>
        Reply
      </label>
      <textarea
        id={`${ids}-body`}
        ref={areaRef}
        className="ops-textarea ops-composer__input"
        value={body}
        rows={3}
        maxLength={REPLY_LIMIT}
        placeholder="Write a reply"
        onChange={(e) => setBody(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : `${ids}-hint`}
        disabled={pending}
      />

      {error && (
        <p className="ops-alert" id={errorId} role="alert">
          {error}
        </p>
      )}

      <div className="ops-composer__foot">
        <p className="ops-composer__hint" id={`${ids}-hint`}>
          {body.length} of {REPLY_LIMIT} characters
        </p>
        <button
          type="submit"
          className="ops-button ops-button--primary"
          disabled={pending || empty}
        >
          {pending ? "Adding..." : "Send reply"}
        </button>
      </div>
    </form>
  );
}
