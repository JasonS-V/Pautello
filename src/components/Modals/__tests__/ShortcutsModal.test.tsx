import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutsModal } from '../ShortcutsModal';

describe('ShortcutsModal Component', () => {
  it('no renderiza nada cuando isOpen es false', () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutsModal isOpen={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza el título y los grupos de atajos cuando isOpen es true', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal isOpen={true} onClose={onClose} keyboardMode="piano" />);

    expect(screen.getByRole('heading', { name: /Atajos de Teclado/i })).toBeInTheDocument();
    expect(screen.getByText(/Modo Piano QWERTY/i)).toBeInTheDocument();
  });

  it('permite filtrar los atajos usando el buscador', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal isOpen={true} onClose={onClose} keyboardMode="piano" />);

    const searchInput = screen.getByPlaceholderText(/Buscar atajo/i);
    fireEvent.change(searchInput, { target: { value: 'octava' } });

    expect(screen.getByText(/Bajar \/ Subir una octava completa/i)).toBeInTheDocument();
  });

  it('ejecuta onClose al pulsar el botón de cerrar', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal isOpen={true} onClose={onClose} keyboardMode="piano" />);

    const closeButtons = screen.getAllByRole('button', { name: /Cerrar/i });
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
