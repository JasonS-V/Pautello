import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingTour, TUTORIAL_STORAGE_KEY } from './OnboardingTour';

describe('OnboardingTour: Tutorial de Bienvenida', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('no renderiza nada cuando isOpen es false', () => {
    const { container } = render(
      <OnboardingTour isOpen={false} onClose={vi.fn()} onComplete={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza el primer paso (Bienvenida) cuando isOpen es true', () => {
    render(<OnboardingTour isOpen={true} onClose={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.getByText('¡Te damos la bienvenida a Pautello!')).toBeDefined();
    expect(screen.getByText('Paso 1 de 6')).toBeDefined();
    expect(screen.getByText('100% Libre & Profesional')).toBeDefined();
  });

  it('avanza por los pasos al pulsar Siguiente', () => {
    render(<OnboardingTour isOpen={true} onClose={vi.fn()} onComplete={vi.fn()} />);

    const nextBtn = screen.getByText('Siguiente');
    fireEvent.click(nextBtn);

    // Paso 2: Barra de herramientas
    expect(screen.getByText('Paso 2 de 6')).toBeDefined();
    expect(screen.getByText('Barra de Herramientas Superior')).toBeDefined();

    // Avanza a Paso 3: Lienzo
    fireEvent.click(screen.getByText('Siguiente'));
    expect(screen.getByText('Paso 3 de 6')).toBeDefined();
    expect(screen.getByText('Escritura y Arrastre en el Lienzo')).toBeDefined();
  });

  it('permite cambiar el modo de teclado en el paso de entrada (Paso 4)', () => {
    const onSelectMode = vi.fn();
    render(
      <OnboardingTour
        isOpen={true}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        keyboardMode="piano"
        onSelectKeyboardMode={onSelectMode}
      />
    );

    // Ir al paso 4
    fireEvent.click(screen.getByText('Siguiente')); // a paso 2
    fireEvent.click(screen.getByText('Siguiente')); // a paso 3
    fireEvent.click(screen.getByText('Siguiente')); // a paso 4

    expect(screen.getByText('Paso 4 de 6')).toBeDefined();
    expect(screen.getByText('Modos de Entrada y Piano Virtual')).toBeDefined();

    // Seleccionar Modo Notación Clásica
    const notationBtn = screen.getByText('🎼 Modo Notación Clásica');
    fireEvent.click(notationBtn);
    expect(onSelectMode).toHaveBeenCalledWith('notation');
  });

  it('cierra y guarda en localStorage al pulsar Saltar', () => {
    const onClose = vi.fn();
    render(<OnboardingTour isOpen={true} onClose={onClose} onComplete={vi.fn()} />);

    const skipBtn = screen.getByTitle('Saltar tutorial (Esc)');
    fireEvent.click(skipBtn);

    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe('true');
  });

  it('completa el tutorial en el último paso y llama a onComplete', () => {
    const onComplete = vi.fn();
    render(<OnboardingTour isOpen={true} onClose={vi.fn()} onComplete={onComplete} />);

    // Avanzar hasta el paso final (paso 6)
    for (let i = 1; i < 6; i++) {
      fireEvent.click(screen.getByText('Siguiente'));
    }

    expect(screen.getByText('Paso 6 de 6')).toBeDefined();
    const finishBtn = screen.getByText('¡Empezar a Crear!');
    fireEvent.click(finishBtn);

    expect(onComplete).toHaveBeenCalled();
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe('true');
  });

  it('soporta navegación con teclado (ArrowRight y Escape)', () => {
    const onClose = vi.fn();
    render(<OnboardingTour isOpen={true} onClose={onClose} onComplete={vi.fn()} />);

    expect(screen.getByText('Paso 1 de 6')).toBeDefined();

    // Flecha derecha para avanzar
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Paso 2 de 6')).toBeDefined();

    // Flecha izquierda para retroceder
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('Paso 1 de 6')).toBeDefined();

    // Escape para salir
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
