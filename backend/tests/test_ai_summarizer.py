"""Tests for AI prompt context optimization, sliding window history, and background summarization."""
import pytest
import datetime
from unittest.mock import AsyncMock, patch
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.services.ai_service import AIService, run_background_summarization

@pytest.mark.asyncio
async def test_get_messages_after_attaches_timestamp():
    mock_db = AsyncMock()
    now = datetime.datetime.now()
    
    mock_rows = [
        {"content": "Hello", "sender_id": "player1", "sender_name": "Alice", "created_at": now},
        {"content": "DM narration", "sender_id": "dm", "sender_name": "Dungeon Master", "created_at": now},
        {"content": "Info message", "sender_id": "system", "sender_name": "System", "created_at": now}
    ]
    
    class MockResult:
        def mappings(self):
            class Mappings:
                def all(self):
                    return mock_rows
            return Mappings()
            
    mock_db.execute.return_value = MockResult()
    
    messages = await AIService.get_messages_after("test_camp", after_date=None, db=mock_db)
    
    assert len(messages) == 3
    assert messages[0].additional_kwargs["created_at"] == now
    assert messages[1].additional_kwargs["created_at"] == now
    assert messages[2].additional_kwargs["created_at"] == now


@pytest.mark.asyncio
async def test_save_memory_with_custom_timestamp():
    mock_db = AsyncMock()
    custom_time = datetime.datetime(2026, 6, 19, 12, 0, 0)
    
    await AIService.save_memory(
        campaign_id="test_camp",
        summary_text="Custom Summary",
        db=mock_db,
        created_at=custom_time
    )
    
    # Verify that the query included created_at override
    mock_db.execute.assert_called_once()
    query_params = mock_db.execute.call_args[0][1]
    assert query_params["created_at"] == custom_time


@pytest.mark.asyncio
async def test_generate_chat_response_sliding_window():
    mock_db = AsyncMock()
    
    # Mock AIService methods
    now = datetime.datetime.now()
    memory_text = "Dungeon start."
    memory_date = now - datetime.timedelta(days=1)
    
    # Create 35 messages (exceeding the threshold of 30)
    messages = []
    for i in range(35):
        msg = HumanMessage(content=f"Message {i}")
        msg.additional_kwargs["created_at"] = now
        messages.append(msg)

    # Patch AIService methods
    with patch.object(AIService, 'get_campaign_config', return_value=("mock-key", "gemini-3-flash-preview", "gemini")), \
         patch.object(AIService, 'get_latest_memory', return_value=(memory_text, memory_date)), \
         patch.object(AIService, 'get_messages_after', return_value=messages), \
         patch('app.services.ai_service.get_dm_graph') as mock_get_graph, \
         patch('app.services.ai_service.run_background_summarization') as mock_bg_sum, \
         patch('asyncio.create_task') as mock_create_task:
         
         # Mock the LangGraph DM graph invoke response
         mock_compiled_graph = AsyncMock()
         mock_compiled_graph.ainvoke.return_value = {
             "messages": [AIMessage(content="The DM speaks.")]
         }
         mock_get_graph.return_value = (mock_compiled_graph, None)
         
         response = await AIService.generate_chat_response(
             campaign_id="test_camp",
             sender_name="Alice",
             db=mock_db,
             sid="test_sid",
             rich_context="Some rich context"
         )
         
         assert response == "The DM speaks."
         
         # Verify that the background task was scheduled
         mock_create_task.assert_called_once()
         mock_bg_sum.assert_called_once_with("test_camp", "mock-key", "gemini-3-flash-preview", "gemini")
         
         # Verify that the graph received only the sliding window messages (latest 10)
         called_inputs = mock_compiled_graph.ainvoke.call_args[0][0]
         called_messages = called_inputs["messages"]
         
         # Filter HumanMessages (excluding system prompt injects)
         human_messages_called = [m for m in called_messages if isinstance(m, HumanMessage)]
         assert len(human_messages_called) == 10
         assert human_messages_called[0].content == "Message 25"
         assert human_messages_called[-1].content == "Message 34"
