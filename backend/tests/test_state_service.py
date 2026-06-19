"""Tests for StateService: patch generation, state emission."""
import pytest
from unittest.mock import AsyncMock
from app.services.state_service import StateService


class TestEmitStateUpdate:
    """Tests for JSON Patch generation and emission."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear the class-level state cache before each test."""
        StateService._last_broadcasted_state.clear()
        yield
        StateService._last_broadcasted_state.clear()

    @pytest.mark.asyncio
    async def test_first_emit_sends_full_state(self, game_state_factory, mock_sio):
        """First emit for a campaign should send full game_state_update."""
        gs = game_state_factory()
        await StateService.emit_state_update("camp1", gs, mock_sio)

        mock_sio.emit.assert_called_once()
        call_args = mock_sio.emit.call_args
        assert call_args[0][0] == 'game_state_update'  # event name
        assert call_args[1]['room'] == 'camp1'

    @pytest.mark.asyncio
    async def test_second_emit_sends_delta_event(self, game_state_factory, mock_sio, enemy_factory, coords):
        """Subsequent emit should send targeted delta event instead of a monolithic patch."""
        gs = game_state_factory()

        # First emit (full state)
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        # Modify state
        gs.enemies[0].hp_current = 5

        # Second emit
        await StateService.emit_state_update("camp1", gs, mock_sio)

        mock_sio.emit.assert_called_once()
        call_args = mock_sio.emit.call_args
        assert call_args[0][0] == 'hp_changed'
        data = call_args[0][1]
        assert data['entity_id'] == gs.enemies[0].id
        assert data['hp_current'] == 5

    @pytest.mark.asyncio
    async def test_no_emit_when_no_changes(self, game_state_factory, mock_sio):
        """No events should be emitted if state hasn't changed."""
        gs = game_state_factory()

        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        # Emit again with no changes
        await StateService.emit_state_update("camp1", gs, mock_sio)

        mock_sio.emit.assert_not_called()

    @pytest.mark.asyncio
    async def test_different_campaigns_independent(self, game_state_factory, mock_sio):
        """Each campaign should have its own cached state."""
        gs1 = game_state_factory()
        gs2 = game_state_factory()

        await StateService.emit_state_update("camp1", gs1, mock_sio)
        await StateService.emit_state_update("camp2", gs2, mock_sio)

        # Both should have sent full state updates
        assert mock_sio.emit.call_count == 2
        for call in mock_sio.emit.call_args_list:
            assert call[0][0] == 'game_state_update'

    @pytest.mark.asyncio
    async def test_delta_contains_hp_change(self, game_state_factory, mock_sio):
        """HP change should emit hp_changed event."""
        gs = game_state_factory()
        original_hp = gs.enemies[0].hp_current

        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        gs.enemies[0].hp_current = original_hp - 5
        await StateService.emit_state_update("camp1", gs, mock_sio)

        mock_sio.emit.assert_called_once()
        call_args = mock_sio.emit.call_args
        assert call_args[0][0] == 'hp_changed'
        data = call_args[0][1]
        assert data['entity_id'] == gs.enemies[0].id
        assert data['hp_current'] == original_hp - 5

    @pytest.mark.asyncio
    async def test_phase_change_in_delta(self, game_state_factory, mock_sio, player_factory, enemy_factory):
        """Phase/turn changes should emit turn_changed event."""
        gs = game_state_factory(phase="exploration")
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        gs.phase = "combat"
        gs.turn_order = [gs.party[0].id, gs.enemies[0].id]
        gs.active_entity_id = gs.party[0].id
        await StateService.emit_state_update("camp1", gs, mock_sio)

        mock_sio.emit.assert_called_once()
        call_args = mock_sio.emit.call_args
        assert call_args[0][0] == 'turn_changed'
        data = call_args[0][1]
        assert data['phase'] == 'combat'
        assert data['active_entity_id'] == gs.party[0].id
