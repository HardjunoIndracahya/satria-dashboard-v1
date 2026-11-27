import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Field, Modal } from './ui';
import { useConfig } from '../store/config';
import { useUi } from '../store/ui';

export function PairingModal() {
  const id = useUi((s) => s.pairingId);
  const close = useUi((s) => s.closePairing);
  const existing = useConfig((s) => (id ? s.pairings[id] : undefined));
  const setPairing = useConfig((s) => s.setPairing);

  const [leader, setLeader] = useState('');
  const [size, setSize] = useState('');
  const [contact, setContact] = useState('');
  const [descent, setDescent] = useState('');

  useEffect(() => {
    if (!id) return;
    setLeader(existing?.leader ?? '');
    setSize(existing?.groupSize !== undefined ? String(existing.groupSize) : '');
    setContact(existing?.contact ?? '');
    setDescent(existing?.descentTime ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sizeNum = size.trim() === '' ? undefined : Number(size);
  const sizeInvalid = sizeNum !== undefined && (!Number.isInteger(sizeNum) || sizeNum < 1 || sizeNum > 500);

  const save = () => {
    if (!id || sizeInvalid) return;
    setPairing(id, { leader: leader.trim(), groupSize: sizeNum, contact: contact.trim(), descentTime: descent });
    toast.success(`${id} pairing saved`);
    close();
  };

  return (
    <Modal
      open={!!id}
      onClose={close}
      width={460}
      title="Device Pairing"
      subtitle={id ? `Assign hiker metadata to ${id}. Stored on this device only.` : undefined}
      footer={
        <>
          {existing && (
            <button
              className="btn mr-auto text-crimson hover:border-crimson/40"
              onClick={() => {
                if (id) setPairing(id, null);
                toast('Pairing cleared');
                close();
              }}
            >
              Clear pairing
            </button>
          )}
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={sizeInvalid}>
            Save pairing
          </button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="col-span-2">
          <Field label="Team Leader Name">
            <input className="field" value={leader} onChange={(e) => setLeader(e.target.value)} autoFocus placeholder="Full name" />
          </Field>
        </div>
        <Field label="Group Size" error={sizeInvalid ? 'Whole number, 1–500' : undefined}>
          <input
            className={`field num ${sizeInvalid ? '!border-amber' : ''}`}
            inputMode="numeric"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="Persons"
          />
        </Field>
        <Field label="Target Descent Time">
          <input className="field num" type="time" value={descent} onChange={(e) => setDescent(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Emergency Contact">
            <input className="field num" type="tel" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+62 …" />
          </Field>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
