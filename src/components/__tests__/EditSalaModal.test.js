// Test for EditSalaModal.vue component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import EditSalaModal from '../EditSalaModal.vue';

describe('EditSalaModal', () => {
  let wrapper;

  const mockSala = {
    id: 'sala-123',
    nombre: 'Almacen'
  };

  const mockAllSalas = [
    { id: 'sala-123', nombre: 'Almacen' },
    { id: 'sala-456', nombre: 'Picking' },
    { id: 'sala-789', nombre: 'Recepcion' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when canEdit is false', () => {
    it('should show informational message when sala cannot be edited', () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: false,
          usageCount: 5
        }
      });

      const message = wrapper.text();
      expect(message).toContain('Esta sala ha sido utilizada en 5 inspección(es)');
      expect(message).toContain('No se puede renombrar para mantener la consistencia de los datos históricos');
    });

    it('should show only Close button when sala cannot be edited', () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: false,
          usageCount: 3
        }
      });

      const buttons = wrapper.findAll('button');
      const buttonTexts = buttons.map(b => b.text());

      expect(buttonTexts).toContain('Cerrar');
      expect(buttonTexts).not.toContain('Guardar Cambios');
    });

    it('should emit close event when Close button is clicked', async () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: false,
          usageCount: 2
        }
      });

      const closeButton = wrapper.findAll('button').find(b => b.text() === 'Cerrar');
      await closeButton.trigger('click');

      expect(wrapper.emitted('close')).toBeTruthy();
      expect(wrapper.emitted('close')).toHaveLength(1);
    });
  });

  describe('when canEdit is true', () => {
    it('should show input field with current sala name', () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      const input = wrapper.find('input[type="text"]');
      expect(input.exists()).toBe(true);
      expect(input.element.value).toBe('Almacen');
    });

    it('should show Cancel and Guardar Cambios buttons', () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      const buttons = wrapper.findAll('button');
      const buttonTexts = buttons.map(b => b.text());

      expect(buttonTexts).toContain('Cancelar');
      expect(buttonTexts).toContain('Guardar Cambios');
    });

    it('should validate that name cannot be empty', async () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      const input = wrapper.find('input[type="text"]');
      await input.setValue('   ');

      const saveButton = wrapper.findAll('button').find(b => b.text() === 'Guardar Cambios');
      await saveButton.trigger('click');

      expect(wrapper.text()).toContain('El nombre de la sala no puede estar vacío');
      expect(wrapper.emitted('save')).toBeFalsy();
    });

    it('should validate that name must be different from current name', async () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      const input = wrapper.find('input[type="text"]');
      await input.setValue('Almacen');

      const saveButton = wrapper.findAll('button').find(b => b.text() === 'Guardar Cambios');
      await saveButton.trigger('click');

      expect(wrapper.text()).toContain('El nuevo nombre debe ser diferente del nombre actual');
      expect(wrapper.emitted('save')).toBeFalsy();
    });

    it('should validate that name cannot already exist (case-insensitive)', async () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      const input = wrapper.find('input[type="text"]');
      await input.setValue('picking'); // lowercase version of existing sala

      const saveButton = wrapper.findAll('button').find(b => b.text() === 'Guardar Cambios');
      await saveButton.trigger('click');

      expect(wrapper.text()).toContain('Ya existe una sala con el nombre "picking"');
      expect(wrapper.emitted('save')).toBeFalsy();
    });

    it('should emit save event with new name when validation passes', async () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      const input = wrapper.find('input[type="text"]');
      await input.setValue('Almacen Principal');

      const saveButton = wrapper.findAll('button').find(b => b.text() === 'Guardar Cambios');
      await saveButton.trigger('click');

      expect(wrapper.emitted('save')).toBeTruthy();
      expect(wrapper.emitted('save')[0]).toEqual(['Almacen Principal']);
    });

    it('should emit close event when Cancel button is clicked', async () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      const cancelButton = wrapper.findAll('button').find(b => b.text() === 'Cancelar');
      await cancelButton.trigger('click');

      expect(wrapper.emitted('close')).toBeTruthy();
      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('should reset error when modal is opened', async () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      // Trigger an error
      const input = wrapper.find('input[type="text"]');
      await input.setValue('');
      const saveButton = wrapper.findAll('button').find(b => b.text() === 'Guardar Cambios');
      await saveButton.trigger('click');

      expect(wrapper.text()).toContain('El nombre de la sala no puede estar vacío');

      // Close and reopen modal
      await wrapper.setProps({ isOpen: false });
      await wrapper.setProps({ isOpen: true });

      // Error should be cleared
      expect(wrapper.text()).not.toContain('El nombre de la sala no puede estar vacío');
    });

    it('should trim whitespace from sala name before validation', async () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      const input = wrapper.find('input[type="text"]');
      await input.setValue('  Nuevo Almacen  ');

      const saveButton = wrapper.findAll('button').find(b => b.text() === 'Guardar Cambios');
      await saveButton.trigger('click');

      expect(wrapper.emitted('save')).toBeTruthy();
      expect(wrapper.emitted('save')[0]).toEqual(['Nuevo Almacen']);
    });
  });

  describe('modal visibility', () => {
    it('should not render when isOpen is false', () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: false,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      expect(wrapper.find('.fixed').exists()).toBe(false);
    });

    it('should render when isOpen is true', () => {
      wrapper = mount(EditSalaModal, {
        props: {
          isOpen: true,
          sala: mockSala,
          allSalas: mockAllSalas,
          canEdit: true,
          usageCount: 0
        }
      });

      expect(wrapper.find('.fixed').exists()).toBe(true);
    });
  });
});
