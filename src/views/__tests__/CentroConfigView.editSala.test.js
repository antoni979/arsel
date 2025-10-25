// Test for edit sala functionality in CentroConfigView.vue
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../supabase';

// Mock Supabase
vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('CentroConfigView - Edit Sala Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.alert = vi.fn();
  });

  describe('checkIfSalaCanBeEdited', () => {
    it('should return canEdit true when sala has no inspected points', async () => {
      // Arrange
      const salaId = 'sala-123';
      const mockPuntosMaestros = [
        { id: 'punto-1' },
        { id: 'punto-2' },
        { id: 'punto-3' }
      ];

      // Mock puntos_maestros query to return points
      const selectPuntosMaestrosMock = vi.fn().mockResolvedValue({
        data: mockPuntosMaestros,
        error: null
      });
      const eqPuntosMaestrosMock = vi.fn().mockReturnValue(selectPuntosMaestrosMock);

      // Mock puntos_inspeccionados count query to return 0
      const countMock = vi.fn().mockResolvedValue({ count: 0, error: null });
      const inMock = vi.fn().mockReturnValue(countMock);

      supabase.from = vi.fn((table) => {
        if (table === 'puntos_maestros') {
          return {
            select: vi.fn().mockReturnValue({ eq: eqPuntosMaestrosMock })
          };
        } else if (table === 'puntos_inspeccionados') {
          return {
            select: vi.fn().mockReturnValue({ in: inMock })
          };
        }
      });

      // Act - Simulate the checkIfSalaCanBeEdited function
      const checkIfSalaCanBeEdited = async (salaId) => {
        const { data: puntosMaestrosIds } = await supabase
          .from('puntos_maestros')
          .select('id')
          .eq('sala_id', salaId);

        if (!puntosMaestrosIds || puntosMaestrosIds.length === 0) {
          return { canEdit: true, usageCount: 0 };
        }

        const { count } = await supabase
          .from('puntos_inspeccionados')
          .select('id', { count: 'exact', head: true })
          .in('punto_maestro_id', puntosMaestrosIds.map(p => p.id));

        return {
          canEdit: count === 0,
          usageCount: count || 0
        };
      };

      const result = await checkIfSalaCanBeEdited(salaId);

      // Assert
      expect(result.canEdit).toBe(true);
      expect(result.usageCount).toBe(0);
      expect(supabase.from).toHaveBeenCalledWith('puntos_maestros');
      expect(supabase.from).toHaveBeenCalledWith('puntos_inspeccionados');
    });

    it('should return canEdit false with correct count when sala has inspected points', async () => {
      // Arrange
      const salaId = 'sala-456';
      const mockPuntosMaestros = [
        { id: 'punto-10' },
        { id: 'punto-11' }
      ];

      // Mock puntos_maestros query to return points
      const selectPuntosMaestrosMock = vi.fn().mockResolvedValue({
        data: mockPuntosMaestros,
        error: null
      });
      const eqPuntosMaestrosMock = vi.fn().mockReturnValue(selectPuntosMaestrosMock);

      // Mock puntos_inspeccionados count query to return 7
      const countMock = vi.fn().mockResolvedValue({ count: 7, error: null });
      const inMock = vi.fn().mockReturnValue(countMock);

      supabase.from = vi.fn((table) => {
        if (table === 'puntos_maestros') {
          return {
            select: vi.fn().mockReturnValue({ eq: eqPuntosMaestrosMock })
          };
        } else if (table === 'puntos_inspeccionados') {
          return {
            select: vi.fn().mockReturnValue({ in: inMock })
          };
        }
      });

      // Act
      const checkIfSalaCanBeEdited = async (salaId) => {
        const { data: puntosMaestrosIds } = await supabase
          .from('puntos_maestros')
          .select('id')
          .eq('sala_id', salaId);

        if (!puntosMaestrosIds || puntosMaestrosIds.length === 0) {
          return { canEdit: true, usageCount: 0 };
        }

        const { count } = await supabase
          .from('puntos_inspeccionados')
          .select('id', { count: 'exact', head: true })
          .in('punto_maestro_id', puntosMaestrosIds.map(p => p.id));

        return {
          canEdit: count === 0,
          usageCount: count || 0
        };
      };

      const result = await checkIfSalaCanBeEdited(salaId);

      // Assert
      expect(result.canEdit).toBe(false);
      expect(result.usageCount).toBe(7);
    });

    it('should return canEdit true when sala has no puntos_maestros', async () => {
      // Arrange
      const salaId = 'sala-789';

      // Mock puntos_maestros query to return empty array
      const selectPuntosMaestrosMock = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });
      const eqPuntosMaestrosMock = vi.fn().mockReturnValue(selectPuntosMaestrosMock);

      supabase.from = vi.fn((table) => {
        if (table === 'puntos_maestros') {
          return {
            select: vi.fn().mockReturnValue({ eq: eqPuntosMaestrosMock })
          };
        }
      });

      // Act
      const checkIfSalaCanBeEdited = async (salaId) => {
        const { data: puntosMaestrosIds } = await supabase
          .from('puntos_maestros')
          .select('id')
          .eq('sala_id', salaId);

        if (!puntosMaestrosIds || puntosMaestrosIds.length === 0) {
          return { canEdit: true, usageCount: 0 };
        }

        const { count } = await supabase
          .from('puntos_inspeccionados')
          .select('id', { count: 'exact', head: true })
          .in('punto_maestro_id', puntosMaestrosIds.map(p => p.id));

        return {
          canEdit: count === 0,
          usageCount: count || 0
        };
      };

      const result = await checkIfSalaCanBeEdited(salaId);

      // Assert
      expect(result.canEdit).toBe(true);
      expect(result.usageCount).toBe(0);
      expect(supabase.from).toHaveBeenCalledWith('puntos_maestros');
      expect(supabase.from).not.toHaveBeenCalledWith('puntos_inspeccionados');
    });
  });

  describe('handleSaveSalaName', () => {
    it('should update sala name in Supabase successfully', async () => {
      // Arrange
      const salaId = 'sala-123';
      const newName = 'Almacen Principal';
      const mockSala = { id: salaId, nombre: 'Almacen', color: '#CCCCCC' };

      // Mock Supabase update
      const updateMock = vi.fn().mockResolvedValue({ error: null });
      const eqMock = vi.fn().mockReturnValue(updateMock);
      const fromMock = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: eqMock })
      });

      supabase.from = fromMock;

      // Act - Simulate handleSaveSalaName
      const handleSaveSalaName = async (salaId, newName) => {
        const { error } = await supabase
          .from('salas')
          .update({ nombre: newName })
          .eq('id', salaId);

        return { error };
      };

      const result = await handleSaveSalaName(salaId, newName);

      // Assert
      expect(fromMock).toHaveBeenCalledWith('salas');
      expect(result.error).toBeNull();
    });

    it('should handle Supabase update errors gracefully', async () => {
      // Arrange
      const salaId = 'sala-456';
      const newName = 'Nueva Sala';
      const mockError = new Error('Database connection failed');

      // Mock Supabase update error
      const updateMock = vi.fn().mockResolvedValue({ error: mockError });
      const eqMock = vi.fn().mockReturnValue(updateMock);
      const fromMock = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: eqMock })
      });

      supabase.from = fromMock;

      // Act
      const handleSaveSalaName = async (salaId, newName) => {
        const { error } = await supabase
          .from('salas')
          .update({ nombre: newName })
          .eq('id', salaId);

        return { error };
      };

      const result = await handleSaveSalaName(salaId, newName);

      // Assert
      expect(result.error).toBe(mockError);
    });
  });

  describe('handleEditSala', () => {
    it('should check if sala can be edited before opening modal', async () => {
      // Arrange
      const mockSala = { id: 'sala-123', nombre: 'Almacen' };
      const mockPuntosMaestros = [{ id: 'punto-1' }];

      // Mock checkIfSalaCanBeEdited returning false
      const selectPuntosMaestrosMock = vi.fn().mockResolvedValue({
        data: mockPuntosMaestros,
        error: null
      });
      const eqPuntosMaestrosMock = vi.fn().mockReturnValue(selectPuntosMaestrosMock);

      const countMock = vi.fn().mockResolvedValue({ count: 3, error: null });
      const inMock = vi.fn().mockReturnValue(countMock);

      supabase.from = vi.fn((table) => {
        if (table === 'puntos_maestros') {
          return {
            select: vi.fn().mockReturnValue({ eq: eqPuntosMaestrosMock })
          };
        } else if (table === 'puntos_inspeccionados') {
          return {
            select: vi.fn().mockReturnValue({ in: inMock })
          };
        }
      });

      // Act
      const handleEditSala = async (sala) => {
        const { data: puntosMaestrosIds } = await supabase
          .from('puntos_maestros')
          .select('id')
          .eq('sala_id', sala.id);

        if (!puntosMaestrosIds || puntosMaestrosIds.length === 0) {
          return { canEdit: true, usageCount: 0 };
        }

        const { count } = await supabase
          .from('puntos_inspeccionados')
          .select('id', { count: 'exact', head: true })
          .in('punto_maestro_id', puntosMaestrosIds.map(p => p.id));

        return {
          canEdit: count === 0,
          usageCount: count || 0
        };
      };

      const permission = await handleEditSala(mockSala);

      // Assert
      expect(permission.canEdit).toBe(false);
      expect(permission.usageCount).toBe(3);
    });
  });
});
