import { describe, expect, it } from 'vitest';
import { readNativeMusicXml } from '../../../scripts/omr-engine-comparison';

describe('independent native MusicXML measurement', () => {
  it('separates sounding alteration from a printed accidental and preserves dots and ties', () => {
    const xml =
      '<score-partwise><part id="P1"><measure><attributes><divisions>4</divisions><key><fifths>1</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>F</step><alter>1</alter><octave>3</octave></pitch><type>half</type><dot/><dot/><tie type="start"/></note><note><rest measure="yes"/></note></measure></part></score-partwise>';
    const native = readNativeMusicXml(xml, new DOMParser());
    expect(native.events[0]).toMatchObject({
      pitch: 'F3',
      accidental: null,
      duration: [1, 2],
      dots: 2,
      tiedOut: true,
    });
    expect(native.events[1]).toMatchObject({ pitch: null, duration: [3, 4] });
  });
  it('reports unsupported voices and empty/invalid exports instead of claiming full coverage', () => {
    expect(() => readNativeMusicXml('<broken>', new DOMParser())).toThrow();
    const native = readNativeMusicXml(
      '<score-partwise><part id="P1"><measure><note><rest/><voice>2</voice><type>quarter</type></note></measure></part></score-partwise>',
      new DOMParser()
    );
    expect(native.skippedVoices).toBe(1);
    expect(native.events).toEqual([]);
  });
});
