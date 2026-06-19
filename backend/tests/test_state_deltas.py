"""Tests for state deltas: granular updates on entity movements, health, conditions, vessels, locations, logs."""
import pytest
from unittest.mock import AsyncMock
from app.services.state_service import StateService
from app.models import Coordinates, Condition, Vessel, LogEntry, Location

class TestStateDeltas:
    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear the class-level state cache before each test."""
        StateService._last_broadcasted_state.clear()
        yield
        StateService._last_broadcasted_state.clear()

    @pytest.mark.asyncio
    async def test_entity_moved(self, game_state_factory, mock_sio):
        gs = game_state_factory()
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        # Move first party member
        gs.party[0].position.q = 10
        gs.party[0].position.r = 11
        gs.party[0].position.s = -21

        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.assert_called_once()
        call_name, data = mock_sio.emit.call_args[0]
        assert call_name == "entity_moved"
        assert data["entity_id"] == gs.party[0].id
        assert data["q"] == 10
        assert data["r"] == 11
        assert data["s"] == -21

    @pytest.mark.asyncio
    async def test_condition_applied_and_removed(self, game_state_factory, mock_sio):
        gs = game_state_factory()
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        # Apply new condition
        cond = Condition(name="Poisoned", duration=3)
        gs.party[0].conditions.append(cond)

        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.assert_called_once()
        call_name, data = mock_sio.emit.call_args[0]
        assert call_name == "condition_applied"
        assert data["entity_id"] == gs.party[0].id
        assert data["condition"]["name"] == "Poisoned"
        assert data["condition"]["duration"] == 3

        mock_sio.emit.reset_mock()

        # Remove condition
        gs.party[0].conditions = []
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.assert_called_once()
        call_name, data = mock_sio.emit.call_args[0]
        assert call_name == "condition_removed"
        assert data["entity_id"] == gs.party[0].id
        assert data["condition_name"] == "Poisoned"

    @pytest.mark.asyncio
    async def test_entity_added_and_removed(self, game_state_factory, mock_sio, enemy_factory):
        gs = game_state_factory()
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        # Add a new enemy
        new_enemy = enemy_factory(name="Goblin Shaman")
        new_id = new_enemy.id
        gs.enemies.append(new_enemy)

        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.assert_called_once()
        call_name, data = mock_sio.emit.call_args[0]
        assert call_name == "entity_added"
        assert data["entity"]["id"] == new_id

        mock_sio.emit.reset_mock()

        # Remove that enemy
        gs.enemies = [e for e in gs.enemies if e.id != new_id]
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.assert_called_once()
        call_name, data = mock_sio.emit.call_args[0]
        assert call_name == "entity_removed"
        assert data["entity_id"] == new_id

    @pytest.mark.asyncio
    async def test_vessel_added_and_removed(self, game_state_factory, mock_sio):
        gs = game_state_factory()
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        # Add vessel
        new_vessel = Vessel(id="vessel-777", name="Chest", position={"q": 1, "r": 2, "s": -3}, contents=["Gold Key"], currency={"gold": 100})
        if not gs.vessels:
            gs.vessels = []
        gs.vessels.append(new_vessel)

        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.assert_called_once()
        call_name, data = mock_sio.emit.call_args[0]
        assert call_name == "vessel_added"
        assert data["vessel"]["id"] == "vessel-777"

        mock_sio.emit.reset_mock()

        # Remove vessel
        gs.vessels = [v for v in gs.vessels if v.id != "vessel-777"]
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.assert_called_once()
        call_name, data = mock_sio.emit.call_args[0]
        assert call_name == "vessel_removed"
        assert data["vessel_id"] == "vessel-777"

    @pytest.mark.asyncio
    async def test_location_changed(self, game_state_factory, mock_sio):
        gs = game_state_factory()
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        # Change location ID
        gs.location.id = "new-dungeon-floor"
        gs.location.name = "Dungeon Floor 2"

        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.assert_called_once()
        call_name, data = mock_sio.emit.call_args[0]
        assert call_name == "location_changed"
        assert data["id"] == "new-dungeon-floor"

    @pytest.mark.asyncio
    async def test_combat_log_added(self, game_state_factory, mock_sio):
        gs = game_state_factory()
        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.reset_mock()

        # Add log entry
        new_log = LogEntry(tick=1, actor_id="player1", action="attack", target_id="enemy1", result="hit", timestamp="2026-06-19T20:30:00Z")
        gs.combat_log.append(new_log)

        await StateService.emit_state_update("camp1", gs, mock_sio)
        mock_sio.emit.assert_called_once()
        call_name, data = mock_sio.emit.call_args[0]
        assert call_name == "combat_log_added"
        assert len(data) == 1
        assert data[0]["actor_id"] == "player1"
